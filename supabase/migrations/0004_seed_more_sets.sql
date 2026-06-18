-- SundayQuiz — flere innebygde norske utsagnssett (utvider 0003). Samme regler
-- som 0003: varmt og inkluderende, ingenting om kropp, familiesituasjon, økonomi
-- eller tro-som-gotcha. Idempotent: faste set-ids + statements bare når settet
-- er tomt. Fortsetter UUID-serien a1000000-…-0005 og oppover.

insert into quiz.statement_sets (id, title, audience, is_builtin, language) values
  ('a1000000-0000-4000-8000-000000000005', 'Konfirmant — bli kjent',   'kirke',    true, 'nb'),
  ('a1000000-0000-4000-8000-000000000006', 'Leir og weekend',          'kirke',    true, 'nb'),
  ('a1000000-0000-4000-8000-000000000007', 'Lovsang og musikk',        'kirke',    true, 'nb'),
  ('a1000000-0000-4000-8000-000000000008', 'Ny på videregående',       'skole',    true, 'nb'),
  ('a1000000-0000-4000-8000-000000000009', 'Påske og vår',             'generell', true, 'nb'),
  ('a1000000-0000-4000-8000-00000000000a', 'Bedehus-klassikere',       'kirke',    true, 'nb'),
  ('a1000000-0000-4000-8000-00000000000b', 'Kor og korps',             'generell', true, 'nb'),
  ('a1000000-0000-4000-8000-00000000000c', 'Friluft og tur',           'generell', true, 'nb'),
  ('a1000000-0000-4000-8000-00000000000d', 'Sommeravslutning',         'skole',    true, 'nb')
on conflict (id) do nothing;

-- ---------- 5. Konfirmant — bli kjent ----------
insert into quiz.statements (set_id, text, sort_order)
select 'a1000000-0000-4000-8000-000000000005', t, ord
from unnest(array[
  'Går i samme klasse som noen her',
  'Spiller på et lag eller i et band',
  'Har vært på en leirhelg før',
  'Kan navnet på minst fem konfirmanter',
  'Har gledet seg til konfirmanttida',
  'Liker å bli kjent med nye folk',
  'Har et instrument hjemme',
  'Har vært nervøs for noe – og gjort det likevel',
  'Hører på podkast',
  'Har en favorittsport å se på',
  'Kan et faktum nesten ingen andre vet',
  'Har sett en hel serie på under ei uke',
  'Liker å sitte bakerst',
  'Har vært frivillig på noe en gang',
  'Har reist med fly',
  'Kan si «hei» på tre språk',
  'Har en hobby de færreste vet om',
  'Har vunnet noe i en konkurranse',
  'Spiller spill sammen med venner',
  'Har vært på samme tur som noen her før',
  'Liker å lage mat',
  'Har en film de har sett mange ganger',
  'Kom hit i dag med godt humør',
  'Gleder seg til kveldsmaten',
  'Tegner eller skriver av og til',
  'Kan plystre en hel melodi'
]) with ordinality as s(t, ord)
where not exists (
  select 1 from quiz.statements where set_id = 'a1000000-0000-4000-8000-000000000005'
);

-- ---------- 6. Leir og weekend ----------
insert into quiz.statements (set_id, text, sort_order)
select 'a1000000-0000-4000-8000-000000000006', t, ord
from unnest(array[
  'Har sovet i sovepose i år',
  'Har vært på leir før',
  'Kan tenne et bål',
  'Liker grøt til frokost på leir',
  'Har sittet ved et leirbål og sunget',
  'Har pakket sekken selv',
  'Har gått seg litt bort en gang – og funnet veien igjen',
  'Liker leirmat bedre enn de innrømmer',
  'Har vært våken lenger enn planlagt på en tur',
  'Kan en leirlek de kan lære bort',
  'Har vunnet en stafett',
  'Har badet i et vann eller en elv',
  'Tar gjerne oppvasken uten å bli spurt',
  'Har sunget en bordvers eller et leir-rop',
  'Liker å være ute hele dagen',
  'Har sovet i lavvo eller telt',
  'Har en favoritt-leirsang',
  'Står gjerne opp tidlig på tur',
  'Liker å sove lenge på tur',
  'Har vært gruppeleder eller hjelpeleder',
  'Har tatt et bilde de er stolte av på en tur',
  'Kan binde minst én knute',
  'Har gledet seg til denne samlingen',
  'Har blitt kjent med en god venn på leir',
  'Liker stillhet i naturen',
  'Gleder seg til neste leir allerede'
]) with ordinality as s(t, ord)
where not exists (
  select 1 from quiz.statements where set_id = 'a1000000-0000-4000-8000-000000000006'
);

-- ---------- 7. Lovsang og musikk ----------
insert into quiz.statements (set_id, text, sort_order)
select 'a1000000-0000-4000-8000-000000000007', t, ord
from unnest(array[
  'Spiller et instrument',
  'Synger gjerne høyt i bilen',
  'Har stått på en scene',
  'Kan teksten til en lovsang utenat',
  'Hører på musikk hver dag',
  'Har vært med i et kor eller et band',
  'Liker å oppdage ny musikk',
  'Har en sang som alltid gjør godt humør',
  'Kan slå an noen akkorder på gitar eller piano',
  'Har sunget foran andre',
  'Liker rolige sanger best',
  'Liker fart og trommer best',
  'Har en favorittartist de har hørt på i årevis',
  'Har vært på en konsert',
  'Plystrer eller nynner ofte',
  'Kan kjenne igjen en sang på de første sekundene',
  'Har laget en spilleliste til noen',
  'Synger i dusjen',
  'Har danset til en sang denne uka',
  'Kan en sang på et annet språk',
  'Har grått av en sang en gang',
  'Liker å synge sammen med mange',
  'Har spilt i en gudstjeneste eller på en samling',
  'Har en sang de gleder seg til å høre i kveld',
  'Kan holde takten med klapping',
  'Har en favorittsalme eller -lovsang'
]) with ordinality as s(t, ord)
where not exists (
  select 1 from quiz.statements where set_id = 'a1000000-0000-4000-8000-000000000007'
);

-- ---------- 8. Ny på videregående ----------
insert into quiz.statements (set_id, text, sort_order)
select 'a1000000-0000-4000-8000-000000000008', t, ord
from unnest(array[
  'Tar bussen eller toget til skolen',
  'Har funnet et nytt yndlingssted på skolen',
  'Kjente ingen i klassen før skolestart',
  'Har gått seg vill i skolebygget minst én gang',
  'Spiller på et lag eller er med i en klubb',
  'Har et fag de gleder seg til',
  'Liker å sitte fremst i timen',
  'Liker å sitte bakerst i timen',
  'Har en god studievane allerede',
  'Tar gjerne notater for hånd',
  'Har vært med på noe nytt i år',
  'Kjenner noen i en annen klasse',
  'Har en favoritt-matpakke',
  'Hører på musikk når de jobber',
  'Har et mål for dette skoleåret',
  'Liker grupper bedre enn å jobbe alene',
  'Liker å jobbe alene bedre enn i gruppe',
  'Har snakket med noen nye denne uka',
  'Har en hobby utenom skolen',
  'Har prøvd en ny rute til skolen',
  'Gleder seg til en pause i dag',
  'Har hjulpet en medelev med noe',
  'Kan navnet på minst fem i klassen',
  'Har en serie eller en bok de anbefaler',
  'Liker friminuttene best',
  'Kom hit i dag med godt humør'
]) with ordinality as s(t, ord)
where not exists (
  select 1 from quiz.statements where set_id = 'a1000000-0000-4000-8000-000000000008'
);

-- ---------- 9. Påske og vår (sesongsett) ----------
insert into quiz.statements (set_id, text, sort_order)
select 'a1000000-0000-4000-8000-000000000009', t, ord
from unnest(array[
  'Har spist påskeegg i år',
  'Liker Kvikk Lunsj på tur',
  'Har vært på påskefjellet en gang',
  'Har lest eller sett en påskekrim',
  'Gleder seg til lysere kvelder',
  'Har sett vårtegn ute denne uka',
  'Har plukket en blomst i år',
  'Liker gul farge om våren',
  'Har stått opp til soloppgang',
  'Har vært på skitur i påska',
  'Liker å være ute når sola kommer',
  'Har ryddet eller vasket vårrent',
  'Har hørt fuglesang om morgenen',
  'Gleder seg til sommeren',
  'Har en favoritt-påskegodteri',
  'Har malt eller pyntet egg en gang',
  'Liker appelsin på fjellet',
  'Har sett snøen smelte bort i år',
  'Har gått tur i bare skjorta i sola',
  'Har en påsketradisjon de er glad i',
  'Har sådd eller plantet noe',
  'Liker påskeferie hjemme best',
  'Har kjent vårlufta og blitt glad',
  'Gleder seg til å bade til sommeren',
  'Har tatt et fint bilde av naturen i vår',
  'Kom hit i dag med godt humør'
]) with ordinality as s(t, ord)
where not exists (
  select 1 from quiz.statements where set_id = 'a1000000-0000-4000-8000-000000000009'
);

-- ---------- 10. Bedehus-klassikere ----------
insert into quiz.statements (set_id, text, sort_order)
select 'a1000000-0000-4000-8000-00000000000a', t, ord
from unnest(array[
  'Har drukket kaffe på et bedehus',
  'Har spist svele eller vafler etter et møte',
  'Kan en sang fra Sangboken eller Syng for Herren',
  'Har vært på basar',
  'Har kjøpt lodd en gang',
  'Har sittet på de samme stolene mange ganger',
  'Kjenner noen som alltid lager kaffen',
  'Har vært med på en utlodning',
  'Har sunget for full hals på en samling',
  'Har tatt med kake til noe',
  'Har vært på et søndagsmøte i år',
  'Liker å sitte sammen med flere generasjoner',
  'Har hjulpet til på kjøkkenet',
  'Har et favorittvers',
  'Har vært på en kjær gammel salme',
  'Kjenner historien til stedet sitt',
  'Har vunnet noe på en basar',
  'Liker andakt med en god historie',
  'Har vært med på dugnad',
  'Har sunget i et kor en gang',
  'Liker nystekt bakst',
  'Har invitert noen med på et møte',
  'Har en favorittstol i salen',
  'Gleder seg til kaffepausen',
  'Har klappet med på en sang',
  'Kom hit i dag med godt humør'
]) with ordinality as s(t, ord)
where not exists (
  select 1 from quiz.statements where set_id = 'a1000000-0000-4000-8000-00000000000a'
);

-- ---------- 11. Kor og korps ----------
insert into quiz.statements (set_id, text, sort_order)
select 'a1000000-0000-4000-8000-00000000000b', t, ord
from unnest(array[
  'Har sunget i et kor',
  'Har spilt i et korps eller band',
  'Kan lese noter litt',
  'Har stått på en scene foran publikum',
  'Har øvd på det samme stykket mange ganger',
  'Liker å opptre sammen med andre',
  'Har vært på en korps- eller kortur',
  'Kan holde takten',
  'Har et instrument de er glad i',
  'Har sunget en solo en gang',
  'Liker generalprøven best',
  'Liker selve konserten best',
  'Har marsjert i et tog',
  'Kan stemme eller starte en sang',
  'Har lært noen andre en sang',
  'Har vært dirigent eller forsanger en gang',
  'Liker lyse stemmer',
  'Liker dype stemmer',
  'Har grått eller fått gåsehud av musikk',
  'Har en favoritt-marsj eller -sang',
  'Har spilt eller sunget ute',
  'Har vært nervøs før en opptreden',
  'Liker å øve sammen med andre',
  'Har en konsert de husker godt',
  'Klapper gjerne med på rytmen',
  'Gleder seg til neste opptreden'
]) with ordinality as s(t, ord)
where not exists (
  select 1 from quiz.statements where set_id = 'a1000000-0000-4000-8000-00000000000b'
);

-- ---------- 12. Friluft og tur ----------
insert into quiz.statements (set_id, text, sort_order)
select 'a1000000-0000-4000-8000-00000000000c', t, ord
from unnest(array[
  'Har gått en topptur i år',
  'Har overnattet ute',
  'Liker matpakke på tur best',
  'Har sett en soloppgang eller solnedgang i år',
  'Kan kjenne igjen minst tre fugler',
  'Har plukket bær i skogen',
  'Har fisket en gang',
  'Liker å gå tur i regnet',
  'Har sett et dyr på tur i år',
  'Har bålkos på programmet i sommer',
  'Liker stillheten i naturen',
  'Har padlet kano eller kajakk',
  'Kan binde en knute',
  'Har gått på ski i år',
  'Har svømt i et vann',
  'Tar gjerne den lengste veien hjem',
  'Har en favoritt-tursti',
  'Liker å stå på toppen og se utover',
  'Har plukket søppel på tur',
  'Har et turbilde de er stolte av',
  'Liker å gå tur alene iblant',
  'Liker å gå tur med flere',
  'Har sovet under åpen himmel',
  'Gleder seg til neste tur',
  'Har tatt en kald dukkert i år',
  'Kom hit i dag med godt humør'
]) with ordinality as s(t, ord)
where not exists (
  select 1 from quiz.statements where set_id = 'a1000000-0000-4000-8000-00000000000c'
);

-- ---------- 13. Sommeravslutning ----------
insert into quiz.statements (set_id, text, sort_order)
select 'a1000000-0000-4000-8000-00000000000d', t, ord
from unnest(array[
  'Gleder seg til sommerferien',
  'Har planer om en tur i sommer',
  'Liker is best på en varm dag',
  'Har badet i år',
  'Har en favoritt-sommeraktivitet',
  'Liker lange, lyse kvelder',
  'Har spilt fotball eller volleyball ute',
  'Har grillet i år',
  'Gleder seg til å sove lenge',
  'Har lært noe nytt dette året',
  'Vil savne noen i ferien',
  'Har en bok de vil lese i sommer',
  'Liker sol bedre enn regn',
  'Liker regn også, av og til',
  'Har en sommersang de er glad i',
  'Har vært på et morsomt arrangement i år',
  'Gleder seg til gjensynet til høsten',
  'Har en sommertradisjon de er glad i',
  'Har syklet mye i år',
  'Vil prøve noe nytt i sommer',
  'Har et bilde fra et fint øyeblikk i år',
  'Liker å være ute hele dagen',
  'Har takket noen for noe i år',
  'Har hjulpet noen dette året',
  'Gleder seg til neste skoleår',
  'Kom hit i dag med godt humør'
]) with ordinality as s(t, ord)
where not exists (
  select 1 from quiz.statements where set_id = 'a1000000-0000-4000-8000-00000000000d'
);
