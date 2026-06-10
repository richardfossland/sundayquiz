-- SundayQuiz — atomic mark RPCs. Supabase REST has no client-side
-- transactions, so claim-validation→insert and confirm→win-eval→ranking are
-- single plpgsql functions (the same pattern as turnering.submit_match_result).
-- Errors are raised with short machine codes; the route handlers map them to
-- HTTP statuses.
--
-- Lock order everywhere: pair advisory lock → mark row → board row → game row.
-- Consistent order = no deadlocks.

-- ---------- lazy expiry (no cron) ----------
-- Called inside create_mark/respond_mark AND first thing in the state GET
-- handlers, which broadcast a mark_resolved event per returned row. The board
-- screen polls state, so even an idle room converges within one refresh.
create or replace function quiz.expire_stale_marks(p_game_id uuid)
returns setof quiz.marks
language sql
as $$
  update quiz.marks
     set status = 'expired', resolved_at = now()
   where game_id = p_game_id
     and status = 'pending'
     and created_at < now() - interval '60 seconds'
  returning *;
$$;

-- ---------- pure win check ----------
-- cells is the board's row-major jsonb array; {"free":true} counts as marked.
-- 'line' = ≥1 complete row/column/diagonal, 'two_lines' = ≥2, 'blackout' = all.
create or replace function quiz.eval_win(
  p_cells jsonb,
  p_marked int[],
  p_grid int,
  p_condition text
) returns boolean
language plpgsql
immutable
as $$
declare
  v_lines int := 0;
  v_total int := p_grid * p_grid;
  v_hit boolean;
  r int; c int; i int;
begin
  -- helper predicate inlined: cell i is "on" if marked or free
  -- rows
  for r in 0 .. p_grid - 1 loop
    v_hit := true;
    for c in 0 .. p_grid - 1 loop
      i := r * p_grid + c;
      if not (i = any(p_marked) or (p_cells -> i) ? 'free') then v_hit := false; exit; end if;
    end loop;
    if v_hit then v_lines := v_lines + 1; end if;
  end loop;
  -- columns
  for c in 0 .. p_grid - 1 loop
    v_hit := true;
    for r in 0 .. p_grid - 1 loop
      i := r * p_grid + c;
      if not (i = any(p_marked) or (p_cells -> i) ? 'free') then v_hit := false; exit; end if;
    end loop;
    if v_hit then v_lines := v_lines + 1; end if;
  end loop;
  -- main diagonal
  v_hit := true;
  for r in 0 .. p_grid - 1 loop
    i := r * p_grid + r;
    if not (i = any(p_marked) or (p_cells -> i) ? 'free') then v_hit := false; exit; end if;
  end loop;
  if v_hit then v_lines := v_lines + 1; end if;
  -- anti-diagonal
  v_hit := true;
  for r in 0 .. p_grid - 1 loop
    i := r * p_grid + (p_grid - 1 - r);
    if not (i = any(p_marked) or (p_cells -> i) ? 'free') then v_hit := false; exit; end if;
  end loop;
  if v_hit then v_lines := v_lines + 1; end if;

  if p_condition = 'blackout' then
    for i in 0 .. v_total - 1 loop
      if not (i = any(p_marked) or (p_cells -> i) ? 'free') then return false; end if;
    end loop;
    return true;
  elsif p_condition = 'two_lines' then
    return v_lines >= 2;
  else -- 'line'
    return v_lines >= 1;
  end if;
end;
$$;

-- ---------- per-pair advisory lock key ----------
create or replace function quiz.pair_lock_key(p_game_id uuid, p_a uuid, p_b uuid)
returns bigint
language sql
immutable
as $$
  select hashtextextended(
    p_game_id::text || ':' || least(p_a, p_b)::text || ':' || greatest(p_a, p_b)::text,
    0
  );
$$;

-- ---------- create_mark: A claims a cell, naming B as verifier ----------
create or replace function quiz.create_mark(
  p_game_id uuid,
  p_claimer_id uuid,
  p_cell_index int,
  p_verifier_id uuid
) returns jsonb
language plpgsql
as $$
declare
  v_game quiz.games%rowtype;
  v_board quiz.boards%rowtype;
  v_cell jsonb;
  v_grid int;
  v_max_pair int;
  v_pair_count int;
  v_mark quiz.marks%rowtype;
  v_constraint text;
begin
  select * into v_game from quiz.games where id = p_game_id;
  if not found or v_game.status <> 'live' then
    raise exception 'game_not_live';
  end if;
  v_grid := coalesce((v_game.config ->> 'gridSize')::int, 4);
  v_max_pair := coalesce((v_game.config ->> 'maxVerificationsPerPair')::int, 1);

  perform quiz.expire_stale_marks(p_game_id);

  if p_verifier_id = p_claimer_id then
    raise exception 'invalid_verifier';
  end if;
  perform 1 from quiz.players
    where id = p_claimer_id and game_id = p_game_id and status = 'active';
  if not found then raise exception 'invalid_claimer'; end if;
  perform 1 from quiz.players
    where id = p_verifier_id and game_id = p_game_id and status = 'active';
  if not found then raise exception 'invalid_verifier'; end if;

  select * into v_board from quiz.boards
    where game_id = p_game_id and player_id = p_claimer_id;
  if not found then raise exception 'board_not_found'; end if;

  if p_cell_index < 0 or p_cell_index >= v_grid * v_grid then
    raise exception 'invalid_cell';
  end if;
  v_cell := v_board.cells -> p_cell_index;
  if v_cell is null then raise exception 'invalid_cell'; end if;
  if v_cell ? 'free' then raise exception 'cell_free'; end if;

  -- Serialise this pair so two in-flight claims can't both pass the cap.
  perform pg_advisory_xact_lock(quiz.pair_lock_key(p_game_id, p_claimer_id, p_verifier_id));

  -- Pair limit counts pending + confirmed in BOTH directions (A↔B is one
  -- relationship — spec §3 note).
  select count(*) into v_pair_count from quiz.marks
    where game_id = p_game_id
      and status in ('pending', 'confirmed')
      and ((claimer_id = p_claimer_id and verifier_id = p_verifier_id)
        or (claimer_id = p_verifier_id and verifier_id = p_claimer_id));
  if v_pair_count >= v_max_pair then
    raise exception 'pair_limit';
  end if;

  begin
    insert into quiz.marks
      (game_id, board_id, cell_index, claimer_id, verifier_id, statement_id, statement_text)
    values
      (p_game_id, v_board.id, p_cell_index, p_claimer_id, p_verifier_id,
       nullif(v_cell ->> 'statementId', '')::uuid, coalesce(v_cell ->> 'text', ''))
    returning * into v_mark;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'marks_one_pending_per_claimer_uq' then
      raise exception 'already_pending';
    else
      raise exception 'cell_taken';
    end if;
  end;

  return to_jsonb(v_mark);
end;
$$;

-- ---------- respond_mark: B answers Ja/Nei; win evaluated on confirm ----------
create or replace function quiz.respond_mark(
  p_mark_id uuid,
  p_verifier_id uuid,
  p_accept boolean
) returns jsonb
language plpgsql
as $$
declare
  v_mark quiz.marks%rowtype;
  v_board quiz.boards%rowtype;
  v_game quiz.games%rowtype;
  v_max_pair int;
  v_pair_count int;
  v_marked int[];
  v_rank int;
  v_bingo jsonb := null;
begin
  select * into v_mark from quiz.marks where id = p_mark_id for update;
  if not found then raise exception 'mark_not_found'; end if;
  if v_mark.verifier_id <> p_verifier_id then raise exception 'not_your_mark'; end if;
  if v_mark.status <> 'pending' then raise exception 'mark_not_pending'; end if;

  -- Re-check age under the row lock (lazy expiry site #2): a confirm racing
  -- the 60s deadline resolves deterministically here.
  if v_mark.created_at < now() - interval '60 seconds' then
    update quiz.marks set status = 'expired', resolved_at = now()
      where id = p_mark_id returning * into v_mark;
    return jsonb_build_object('mark', to_jsonb(v_mark), 'bingo', null);
  end if;

  if not p_accept then
    update quiz.marks set status = 'rejected', resolved_at = now()
      where id = p_mark_id returning * into v_mark;
    return jsonb_build_object('mark', to_jsonb(v_mark), 'bingo', null);
  end if;

  select * into v_game from quiz.games where id = v_mark.game_id;
  v_max_pair := coalesce((v_game.config ->> 'maxVerificationsPerPair')::int, 1);

  -- Belt-and-braces confirmed-count recheck under the pair lock (create_mark
  -- counts pendings, so a breach here should be impossible — but cheap).
  perform pg_advisory_xact_lock(
    quiz.pair_lock_key(v_mark.game_id, v_mark.claimer_id, v_mark.verifier_id));
  select count(*) into v_pair_count from quiz.marks
    where game_id = v_mark.game_id
      and status = 'confirmed'
      and ((claimer_id = v_mark.claimer_id and verifier_id = v_mark.verifier_id)
        or (claimer_id = v_mark.verifier_id and verifier_id = v_mark.claimer_id));
  if v_pair_count >= v_max_pair then
    update quiz.marks set status = 'rejected', resolved_at = now()
      where id = p_mark_id returning * into v_mark;
    return jsonb_build_object(
      'mark', to_jsonb(v_mark), 'bingo', null, 'reason', 'pair_limit');
  end if;

  update quiz.marks set status = 'confirmed', resolved_at = now()
    where id = p_mark_id returning * into v_mark;

  select * into v_board from quiz.boards where id = v_mark.board_id for update;

  if v_board.bingo_at is null and v_game.status = 'live' then
    select coalesce(array_agg(cell_index), '{}') into v_marked
      from quiz.marks
      where board_id = v_board.id and status = 'confirmed';
    if quiz.eval_win(
      v_board.cells, v_marked,
      coalesce((v_game.config ->> 'gridSize')::int, 4),
      coalesce(v_game.config ->> 'winCondition', 'line')
    ) then
      -- Serialise rank assignment across simultaneous bingos.
      perform 1 from quiz.games where id = v_game.id for update;
      select count(*) + 1 into v_rank
        from quiz.boards where game_id = v_game.id and bingo_at is not null;
      update quiz.boards set bingo_at = now(), bingo_rank = v_rank
        where id = v_board.id;
      v_bingo := jsonb_build_object('rank', v_rank, 'at', now());
    end if;
  end if;

  return jsonb_build_object('mark', to_jsonb(v_mark), 'bingo', v_bingo);
end;
$$;

grant execute on all functions in schema quiz to service_role;
