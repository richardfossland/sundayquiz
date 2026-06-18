-- SundayQuiz — flere innebygde Kahoot-spørsmålssett (utvider 0004_quiz_mode sitt
-- ene Bibelquiz-sett). Hører til på grenen `feat/quiz-mode` og forutsetter at
-- 0004_quiz_mode har laget quiz.question_sets / quiz.questions. Samme seed-
-- mønster og idempotens som 0004: faste b2000000-…-ids, options som jsonb med
-- nøyaktig 4 alternativer, correct_index 0..3, statements bare når settet er tomt.

insert into quiz.question_sets (id, title, audience, is_builtin, language) values
  ('b2000000-0000-4000-8000-000000000002', 'Bibelquiz — Det gamle testamentet', 'kirke',    true, 'nb'),
  ('b2000000-0000-4000-8000-000000000003', 'Bibelquiz — Jesus og evangeliene',  'kirke',    true, 'nb'),
  ('b2000000-0000-4000-8000-000000000004', 'Kirkeåret og høytider',             'kirke',    true, 'nb'),
  ('b2000000-0000-4000-8000-000000000005', 'Salmer og lovsang',                 'kirke',    true, 'nb'),
  ('b2000000-0000-4000-8000-000000000006', 'Bibelske tall og navn',             'kirke',    true, 'nb'),
  ('b2000000-0000-4000-8000-000000000007', 'Påske-quiz',                        'kirke',    true, 'nb'),
  ('b2000000-0000-4000-8000-000000000008', 'Bli kjent med kristen-Norge',       'generell', true, 'nb')
on conflict (id) do nothing;

-- ---------- 2. Bibelquiz — Det gamle testamentet ----------
insert into quiz.questions (set_id, prompt, options, correct_index, sort_order)
select 'b2000000-0000-4000-8000-000000000002', q.prompt, q.options::jsonb, q.correct_index, q.ord
from (values
  ('Hvem ledet israelittene ut av Egypt?', '["Josef","Moses","Josva","Samuel"]', 1, 1),
  ('Hvor mange bud fikk Moses på steintavlene?', '["Fem","Sju","Ti","Tolv"]', 2, 2),
  ('Hvem felte kjempen Goliat med en slynge?', '["Saul","David","Jonatan","Samson"]', 1, 3),
  ('Hva het hagen der Adam og Eva bodde?', '["Edens hage","Getsemane","Betania","Emmaus"]', 0, 4),
  ('Hvem ble slukt av en stor fisk?', '["Elia","Jona","Daniel","Job"]', 1, 5),
  ('Hvor mange dager og netter regnet det under storflommen?', '["Sju","Tjue","Førti","Hundre"]', 2, 6),
  ('Hvem tydet faraos drømmer i Egypt?', '["Daniel","Josef","Aron","Moses"]', 1, 7),
  ('Hva het sønnen Abraham skulle ofre?', '["Isak","Jakob","Esau","Ismael"]', 0, 8),
  ('Hvem mistet styrken sin da håret ble klippet?', '["Samson","Saul","Gideon","Goliat"]', 0, 9),
  ('Hvem ble berget i løvehulen?', '["Josef","Daniel","Jeremia","Esekiel"]', 1, 10),
  ('Hva het broren til Moses som var talsmann?', '["Aron","Josva","Kaleb","Nadab"]', 0, 11)
) as q(prompt, options, correct_index, ord)
where not exists (
  select 1 from quiz.questions where set_id = 'b2000000-0000-4000-8000-000000000002'
);

-- ---------- 3. Bibelquiz — Jesus og evangeliene ----------
insert into quiz.questions (set_id, prompt, options, correct_index, sort_order)
select 'b2000000-0000-4000-8000-000000000003', q.prompt, q.options::jsonb, q.correct_index, q.ord
from (values
  ('Hvem døpte Jesus i Jordanelva?', '["Peter","Johannes døperen","Paulus","Andreas"]', 1, 1),
  ('Hvor mange evangelier åpner Det nye testamentet?', '["To","Tre","Fire","Fem"]', 2, 2),
  ('Hva het Jesu mor?', '["Marta","Maria","Elisabet","Anna"]', 1, 3),
  ('I hvilken by vokste Jesus opp?', '["Betlehem","Jerusalem","Nasaret","Jeriko"]', 2, 4),
  ('Hva gjorde Jesus med vannet i bryllaupet i Kana?', '["Stilnet det","Gjorde det til vin","Gikk på det","Delte det"]', 1, 5),
  ('Hvem fornektet Jesus tre ganger?', '["Judas","Peter","Tomas","Filip"]', 1, 6),
  ('Hva het stedet der Jesus ble korsfestet?', '["Golgata","Getsemane","Betania","Emmaus"]', 0, 7),
  ('Hva slags fortelling er den om den barmhjertige samaritan?', '["En salme","En lignelse","Et brev","En profeti"]', 1, 8),
  ('Hva slags yrke hadde flere av Jesu første disipler?', '["Bønder","Fiskere","Snekkere","Skriftlærde"]', 1, 9),
  ('Hvem tvilte og ville kjenne på Jesu sår?', '["Tomas","Peter","Jakob","Andreas"]', 0, 10),
  ('Hvor mange brød mettet Jesus folkemengden med (i tillegg til fisk)?', '["To","Fem","Sju","Tolv"]', 1, 11)
) as q(prompt, options, correct_index, ord)
where not exists (
  select 1 from quiz.questions where set_id = 'b2000000-0000-4000-8000-000000000003'
);

-- ---------- 4. Kirkeåret og høytider ----------
insert into quiz.questions (set_id, prompt, options, correct_index, sort_order)
select 'b2000000-0000-4000-8000-000000000004', q.prompt, q.options::jsonb, q.correct_index, q.ord
from (values
  ('Hvilken høytid feirer at Jesus ble født?', '["Påske","Pinse","Jul","Kristi himmelfart"]', 2, 1),
  ('Hva markerer pinse?', '["Jesu fødsel","At Den hellige ånd kom","Jesu dåp","Skapelsen"]', 1, 2),
  ('Hva kalles de fire ukene før jul?', '["Faste","Advent","Pinse","Påske"]', 1, 3),
  ('Hvilken dag feirer vi at Jesus stod opp?', '["Julaften","Langfredag","Første påskedag","Allehelgensdag"]', 2, 4),
  ('Hva heter dagen Jesus ble korsfestet?', '["Skjærtorsdag","Langfredag","Palmesøndag","Askeonsdag"]', 1, 5),
  ('Hva feires på Kristi himmelfartsdag?', '["Jesu fødsel","At Jesus fór opp til himmelen","Pinse","Skapelsen"]', 1, 6),
  ('Hvor mange søndager i advent er det?', '["To","Tre","Fire","Fem"]', 2, 7),
  ('Hva markerer palmesøndag?', '["Jesu inntog i Jerusalem","Jesu dåp","Pinse","Jul"]', 0, 8),
  ('Hvilken høytid kommer 50 dager etter påske?', '["Jul","Pinse","Advent","Allehelgensdag"]', 1, 9),
  ('Hvilken farge forbindes ofte med advent og faste i kirka?', '["Grønn","Fiolett","Rød","Gul"]', 1, 10)
) as q(prompt, options, correct_index, ord)
where not exists (
  select 1 from quiz.questions where set_id = 'b2000000-0000-4000-8000-000000000004'
);

-- ---------- 5. Salmer og lovsang ----------
insert into quiz.questions (set_id, prompt, options, correct_index, sort_order)
select 'b2000000-0000-4000-8000-000000000005', q.prompt, q.options::jsonb, q.correct_index, q.ord
from (values
  ('Hva betyr ordet «halleluja»?', '["Pris Herren","Fred","Amen","Hellig"]', 0, 1),
  ('Hva betyr «amen» til slutt i en bønn?', '["Farvel","Det er sant, la det skje","Halleluja","Pris"]', 1, 2),
  ('Hvilket instrument nevnes ofte i Salmenes bok for å lovprise Gud?', '["Harpe","Piano","Gitar","Fiolin"]', 0, 3),
  ('Hvem skrev mange av salmene i Salmenes bok, ifølge tradisjonen?', '["Moses","Kong David","Paulus","Salomo"]', 1, 4),
  ('På hvilket språk ble «Glade jul» («Stille Nacht») opprinnelig skrevet?', '["Engelsk","Tysk","Norsk","Latin"]', 1, 5),
  ('Hva kalles et kort parti man gjentar i en lovsang?', '["Vers","Refreng","Prolog","Epistel"]', 1, 6),
  ('Hva heter hovedsalmeboka i Den norske kirke fra 2013?', '["Sangboken","Norsk salmebok","Salmer 1997","Syng håp"]', 1, 7),
  ('Hva er en «salme»?', '["En sang til Guds ære","En bønn uten ord","En bibelfortelling","En preken"]', 0, 8),
  ('I hvilken høytid synges «Deg være ære» oftest?', '["Jul","Påske","Pinse","Advent"]', 1, 9),
  ('Hva kalles det å synge Guds pris?', '["Lovsang","Preken","Tekstlesning","Velsignelse"]', 0, 10)
) as q(prompt, options, correct_index, ord)
where not exists (
  select 1 from quiz.questions where set_id = 'b2000000-0000-4000-8000-000000000005'
);

-- ---------- 6. Bibelske tall og navn ----------
insert into quiz.questions (set_id, prompt, options, correct_index, sort_order)
select 'b2000000-0000-4000-8000-000000000006', q.prompt, q.options::jsonb, q.correct_index, q.ord
from (values
  ('Hvor mange disipler valgte Jesus ut?', '["Sju","Ti","Tolv","Sytti"]', 2, 1),
  ('Hvor mange dager fastet Jesus i ørkenen?', '["Sju","Tjue","Førti","Hundre"]', 2, 2),
  ('Hvor mange bøker er det til sammen i Bibelen?', '["33","49","66","100"]', 2, 3),
  ('Hvilket tall står ofte for det fullkomne i Bibelen?', '["Tre","Sju","Ni","Tretten"]', 1, 4),
  ('Hva het den første mannen ifølge Bibelen?', '["Abraham","Adam","Noah","Kain"]', 1, 5),
  ('Hvor mange mennesker var med Noah i arken?', '["Fire","Seks","Åtte","Ti"]', 2, 6),
  ('Hva het de to første sønnene til Adam og Eva?', '["Kain og Abel","Set og Enok","Jakob og Esau","Isak og Ismael"]', 0, 7),
  ('Hva ble Jesu tolv nærmeste kalt?', '["Profeter","Disipler","Levitter","Fariseere"]', 1, 8),
  ('Hvor mange brød brukte Jesus da han mettet de fem tusen?', '["To","Fem","Sju","Tolv"]', 1, 9),
  ('Hva het Jesu mor og slektningen hennes som også ventet barn?', '["Maria og Elisabet","Marta og Maria","Maria og Anna","Rut og Noomi"]', 0, 10)
) as q(prompt, options, correct_index, ord)
where not exists (
  select 1 from quiz.questions where set_id = 'b2000000-0000-4000-8000-000000000006'
);

-- ---------- 7. Påske-quiz ----------
insert into quiz.questions (set_id, prompt, options, correct_index, sort_order)
select 'b2000000-0000-4000-8000-000000000007', q.prompt, q.options::jsonb, q.correct_index, q.ord
from (values
  ('Hva feirer vi første påskedag?', '["Jesu fødsel","Jesu oppstandelse","Jesu dåp","Pinse"]', 1, 1),
  ('Hvilken dag ble Jesus korsfestet?', '["Skjærtorsdag","Langfredag","Palmesøndag","Påskeaften"]', 1, 2),
  ('Hva skjedde skjærtorsdag?', '["Det siste måltidet","Korsfestelsen","Oppstandelsen","Inntoget i Jerusalem"]', 0, 3),
  ('Hva ropte folket da Jesus red inn i Jerusalem?', '["Halleluja","Hosianna","Amen","Maranata"]', 1, 4),
  ('Hva het hagen der Jesus ba natten før han ble fanget?', '["Eden","Getsemane","Golgata","Betania"]', 1, 5),
  ('Hvem dømte til slutt Jesus til korsfestelse?', '["Herodes","Pontius Pilatus","Kaifas","Judas"]', 1, 6),
  ('Hva fant kvinnene da de kom til graven påskemorgen?', '["Graven var tom","Jesus lå der","En soldat sov","Steinen var på plass"]', 0, 7),
  ('Hva slags måltid feiret Jesus med disiplene skjærtorsdag?', '["Påskemåltid","Bryllaup","Frokost","Høstfest"]', 0, 8),
  ('Hvilken dag stod Jesus opp, ifølge påskefortellingen?', '["Den tredje dagen","Den sjuende dagen","Den førtiende dagen","Samme dag"]', 0, 9),
  ('Hva kalles uka før påske med alle hendelsene?', '["Adventsuka","Den stille uke","Pinseuka","Høstuka"]', 1, 10)
) as q(prompt, options, correct_index, ord)
where not exists (
  select 1 from quiz.questions where set_id = 'b2000000-0000-4000-8000-000000000007'
);

-- ---------- 8. Bli kjent med kristen-Norge ----------
insert into quiz.questions (set_id, prompt, options, correct_index, sort_order)
select 'b2000000-0000-4000-8000-000000000008', q.prompt, q.options::jsonb, q.correct_index, q.ord
from (values
  ('Hvilken konge falt på Stiklestad i 1030 og knyttes til kristningen av Norge?', '["Harald Hårfagre","Olav den hellige","Håkon den gode","Harald Hardråde"]', 1, 1),
  ('Hva heter den store middelalderkatedralen i Trondheim?', '["Nidarosdomen","Oslo domkirke","Bergen domkirke","Stavanger domkirke"]', 0, 2),
  ('Hvilket kirkesamfunn er størst i Norge?', '["Den katolske kirke","Den norske kirke","Pinsebevegelsen","Frelsesarmeen"]', 1, 3),
  ('Hva kalles de gamle norske trekirkene fra middelalderen?', '["Stavkirker","Katedraler","Kapeller","Basilikaer"]', 0, 4),
  ('Hvilken reformator står bak reformasjonen som kom til Norge i 1537?', '["Martin Luther","Jean Calvin","Hans Nielsen Hauge","Augustin"]', 0, 5),
  ('Hvilken lekpredikant vekket folk rundt år 1800 i Norge?', '["Petter Dass","Hans Nielsen Hauge","Elias Blix","Ole Hallesby"]', 1, 6),
  ('Hvilken prest og dikter er kjent for «Nordlands Trompet»?', '["Petter Dass","Elias Blix","Magnus B. Landstad","Hans A. Brorson"]', 0, 7),
  ('Hvilken høytid er fridag i Norge og feirer Jesu oppstandelse?', '["Jul","Påske","Sankthans","Olsok"]', 1, 8),
  ('I hvilken del av Bibelen finner vi Salmenes bok?', '["Det gamle testamentet","Det nye testamentet","Evangeliene","Apostlenes gjerninger"]', 0, 9),
  ('Hva heter den eldste hoveddelen av Bibelen, skrevet før Jesu tid?', '["Det nye testamentet","Det gamle testamentet","Åpenbaringen","Brevene"]', 1, 10)
) as q(prompt, options, correct_index, ord)
where not exists (
  select 1 from quiz.questions where set_id = 'b2000000-0000-4000-8000-000000000008'
);
