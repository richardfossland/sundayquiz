-- SundayQuiz — bundled Norwegian statement sets (spec §7). These ARE the
-- first-time host experience: warm, inclusive, nothing about body, family
-- situation, economy, or beliefs-as-gotcha. Idempotent: fixed set ids +
-- statements only inserted when the set is empty.

insert into quiz.statement_sets (id, title, audience, is_builtin, language) values
  ('a1000000-0000-4000-8000-000000000001', 'Bli kjent — generell',      'generell', true, 'nb'),
  ('a1000000-0000-4000-8000-000000000002', 'Bli kjent — ungdomsskole',  'skole',    true, 'nb'),
  ('a1000000-0000-4000-8000-000000000003', 'Ny i menigheten',           'kirke',    true, 'nb'),
  ('a1000000-0000-4000-8000-000000000004', 'Jul og vinter',             'generell', true, 'nb')
on conflict (id) do nothing;

-- ---------- 1. Bli kjent — generell ----------
insert into quiz.statements (set_id, text, sort_order)
select 'a1000000-0000-4000-8000-000000000001', t, ord
from unnest(array[
  'Har vært i utlandet i år',
  'Spiller et instrument',
  'Har en yngre søster',
  'Liker vinter bedre enn sommer',
  'Har sett soloppgangen i år',
  'Kan plystre en hel melodi',
  'Har gått på ski i år',
  'Liker ananas på pizza',
  'Har et kjæledyr',
  'Har badet i havet i år',
  'Kan si noe på tre språk',
  'Har sovet i telt',
  'Drikker te oftere enn kaffe',
  'Har vunnet noe i en konkurranse',
  'Kan sjonglere med tre baller',
  'Har lest en bok denne måneden',
  'Har bakt brød selv',
  'Står opp før klokka sju til vanlig',
  'Har plukket bær i skogen',
  'Kan navnet på alle i rommet … nesten',
  'Har syklet til noe i dag',
  'Liker å synge i dusjen',
  'Har vært på fjelltopp i år',
  'Har samme favorittfarge som deg',
  'Kan en vits utenat',
  'Har spilt brettspill denne uka',
  'Har skrevet et håndskrevet brev i år',
  'Gleder seg til noe denne måneden'
]) with ordinality as s(t, ord)
where not exists (
  select 1 from quiz.statements where set_id = 'a1000000-0000-4000-8000-000000000001'
);

-- ---------- 2. Bli kjent — ungdomsskole ----------
insert into quiz.statements (set_id, text, sort_order)
select 'a1000000-0000-4000-8000-000000000002', t, ord
from unnest(array[
  'Går eller sykler til skolen',
  'Har vunnet noe i en konkurranse',
  'Kan navnet på alle lærerne sine',
  'Spiller på et lag',
  'Har et instrument hjemme',
  'Liker matte … helt ærlig',
  'Har vært på leirskole',
  'Kan svømme 200 meter',
  'Har en matboks med i dag',
  'Hører på musikk hver dag',
  'Har sett en hel serie på under ei uke',
  'Kan en dans fra et spill eller en video',
  'Har lest en bok som var bedre enn filmen',
  'Har et søskenbarn i en annen by',
  'Liker å stå på ski eller snowboard',
  'Har laget middag til familien sin',
  'Kan si alfabetet baklengs',
  'Har vært våken etter midnatt i helga',
  'Tegner eller maler av og til',
  'Har gått tur med en hund',
  'Kan navnet på fem land i Afrika',
  'Har samme skostørrelse som deg',
  'Spiller sjakk eller kort',
  'Har badet ute i år',
  'Gleder seg til en ferie',
  'Har en hobby de færreste vet om'
]) with ordinality as s(t, ord)
where not exists (
  select 1 from quiz.statements where set_id = 'a1000000-0000-4000-8000-000000000002'
);

-- ---------- 3. Ny i menigheten / kirkekveld ----------
insert into quiz.statements (set_id, text, sort_order)
select 'a1000000-0000-4000-8000-000000000003', t, ord
from unnest(array[
  'Har gått i denne kirka i mindre enn ett år',
  'Spiller eller synger',
  'Har vært på leir',
  'Lager god kaffe',
  'Har vært med på dugnad i år',
  'Kjenner noen her fra før av',
  'Har sunget i kor en gang',
  'Er her for første gang i dag',
  'Har bakt noe til et kirkearrangement',
  'Bor mindre enn ti minutter unna',
  'Har flyttet hit fra et annet sted',
  'Liker å sitte bakerst',
  'Liker å sitte fremst',
  'Har vært frivillig på noe i år',
  'Kan navnet på minst fem her i kveld',
  'Har med seg noen hit i dag',
  'Har et favorittvers eller en favorittsang',
  'Har vært på tur med folk herfra',
  'Liker å lage mat til mange',
  'Har holdt en mikrofon i denne salen',
  'Har gått på søndagsskole som barn',
  'Spiller et instrument',
  'Har invitert noen med til kirka en gang',
  'Gleder seg til kveldsmaten',
  'Har et bilde av en solnedgang på mobilen',
  'Kom hit i dag med godt humør'
]) with ordinality as s(t, ord)
where not exists (
  select 1 from quiz.statements where set_id = 'a1000000-0000-4000-8000-000000000003'
);

-- ---------- 4. Jul og vinter (sesongsett) ----------
insert into quiz.statements (set_id, text, sort_order)
select 'a1000000-0000-4000-8000-000000000004', t, ord
from unnest(array[
  'Har pyntet til jul allerede',
  'Har bakt pepperkaker i år',
  'Kan teksten til en julesang utenat',
  'Har gått på skøyter',
  'Liker marsipan',
  'Har laget snømann i år',
  'Åpner én gave på julaften-morgenen',
  'Har sett en julefilm denne måneden',
  'Drikker gløgg eller kakao når det er kaldt',
  'Har strikket eller fått noe strikket i år',
  'Har et adventslys hjemme',
  'Liker ribbe bedre enn pinnekjøtt',
  'Liker pinnekjøtt bedre enn ribbe',
  'Har vært på julemarked',
  'Har laget julegave selv en gang',
  'Kan gå på ski',
  'Har ake-utstyr hjemme',
  'Synger med på julesanger i bilen',
  'Har en julegenser',
  'Har feiret jul et annet sted enn hjemme',
  'Liker å måke snø … litt',
  'Har tent lys for noen i år',
  'Gleder seg mest til maten',
  'Gleder seg mest til folkene',
  'Har allerede en juleønskeliste'
]) with ordinality as s(t, ord)
where not exists (
  select 1 from quiz.statements where set_id = 'a1000000-0000-4000-8000-000000000004'
);
