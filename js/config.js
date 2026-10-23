/* ═══════════════════════════════════════════════════════════
   config.js · partidos, sectores (comunidades), textos y
   pesos de la simulación.
   Los pesos electorales son DATOS DE DEMOSTRACIÓN orientativos
   (orden de magnitud de los últimos comicios), no encuestas.
   ═══════════════════════════════════════════════════════════ */
window.WAR = (function () {
  "use strict";

  /* ── PARTIDOS ───────────────────────────────────────────── */
  const PARTIES = [
    { id: "psoe",   name: "PSOE",           color: "#f1283c", tags: ["#PSOE", "#PSdeG", "#PedroSánchez"], keys: ["psoe", "sanchez", "sánchez", "socialista", "pedro sanchez", "#psde"] },
    { id: "pp",     name: "PP",             color: "#2f8dff", tags: ["#PP", "#PartidoPopular", "#Feijóo"], keys: ["pp", "feijoo", "feijóo", "partido popular", "popular", "núñez feijóo"] },
    { id: "vox",    name: "VOX",            color: "#2ee06a", tags: ["#VOX", "#VoxEspaña"], keys: ["vox", "abascal", "espña", "ley de extranjería"] },
    { id: "sumar",  name: "Sumar",          color: "#ff59b0", tags: ["#Sumar", "#Díaz"], keys: ["sumar", "yolanda díaz", "diaz", "segunda alternativa"] },
    { id: "podemos",name: "Podemos",        color: "#a970ff", tags: ["#Podemos", "#Ione"], keys: ["podemos", "ione belarra", "monedero", "moradista"] },
    { id: "otros",  name: "Otros / Nacional", color: "#ffb020", tags: ["#ERC", "#Junts", "#PNV", "#BNG", "#EH Bildu"], keys: ["erc", "junts", "puigdemont", "pnv", "bng", "eh bildu", "bildu", "rufián", "esquerra"] }
  ];
  const PARTY_MAP = Object.fromEntries(PARTIES.map(p => [p.id, p]));

  /* ── SECTORES (comunidades autónomas) ───────────────────── */
  // w  = peso poblacional (millones aprox.) → probabilidad de origen
  // b  = afinidad por partido (sesgo del territorio)
  // dx/dy = desplazamiento de la etiqueta en el mapa
  const REGIONS = [
    { id: "andalucia", name: "Andalucía",        label: "Andalucía",        w: 8.6,  b: { psoe: .40, pp: .30, vox: .18, sumar: .06, podemos: .02, otros: .04 } },
    { id: "aragon",    name: "Aragón",           label: "Aragón",           w: 1.35, b: { psoe: .33, pp: .36, vox: .17, sumar: .07, podemos: .02, otros: .05 } },
    { id: "asturias",  name: "Asturias",         label: "Asturias",         w: 1.0,  b: { psoe: .41, pp: .29, vox: .15, sumar: .05, podemos: .07, otros: .03 } },
    { id: "baleares",  name: "Illes Balears",    label: "Baleares",         w: 1.2,  b: { psoe: .28, pp: .37, vox: .21, sumar: .07, podemos: .02, otros: .05 } },
    { id: "canarias",  name: "Canarias",         label: "Canarias",         w: 2.2,  b: { psoe: .35, pp: .32, vox: .14, sumar: .07, podemos: .03, otros: .09 } },
    { id: "cantabria", name: "Cantabria",        label: "Cantabria",        w: 0.58, b: { psoe: .30, pp: .33, vox: .15, sumar: .04, podemos: .03, otros: .15 } },
    { id: "clm",       name: "Castilla-La Mancha", label: "Castilla-Mancha", w: 2.05, b: { psoe: .34, pp: .37, vox: .21, sumar: .05, podemos: .01, otros: .02 } },
    { id: "cleon",     name: "Castilla y León",  label: "Castilla y León",  w: 2.4,  b: { psoe: .30, pp: .44, vox: .19, sumar: .04, podemos: .01, otros: .02 } },
    { id: "cataluna",  name: "Cataluña",         label: "Cataluña",         w: 7.9,  b: { psoe: .30, pp: .17, vox: .10, sumar: .07, podemos: .03, otros: .33 } },
    { id: "cvalenciana", name: "Comunitat Valenciana", label: "C. Valenciana", w: 5.1, b: { psoe: .27, pp: .38, vox: .24, sumar: .07, podemos: .02, otros: .02 } },
    { id: "extremadura", name: "Extremadura",    label: "Extremadura",      w: 1.05, b: { psoe: .46, pp: .32, vox: .14, sumar: .05, podemos: .02, otros: .01 } },
    { id: "galicia",   name: "Galicia",          label: "Galicia",          w: 2.7,  b: { psoe: .30, pp: .44, vox: .15, sumar: .04, podemos: .02, otros: .05 } },
    { id: "madrid",    name: "Comunidad de Madrid", label: "Madrid",         w: 6.9,  b: { psoe: .28, pp: .42, vox: .20, sumar: .06, podemos: .03, otros: .01 } },
    { id: "murcia",    name: "Región de Murcia", label: "Murcia",           w: 1.55, b: { psoe: .26, pp: .40, vox: .25, sumar: .05, podemos: .02, otros: .02 } },
    { id: "navarra",   name: "Navarra",          label: "Navarra",          w: 0.68, b: { psoe: .27, pp: .31, vox: .14, sumar: .05, podemos: .05, otros: .18 } },
    { id: "paisvasco", name: "País Vasco",       label: "P. Vasco",         w: 2.2,  b: { psoe: .26, pp: .11, vox: .06, sumar: .05, podemos: .04, otros: .48 } },
    { id: "larioja",   name: "La Rioja",         label: "La Rioja",         w: 0.32, b: { psoe: .33, pp: .38, vox: .17, sumar: .05, podemos: .02, otros: .05 } },
    { id: "ceuta",     name: "Ceuta",            label: "Ceuta",            w: 0.09, b: { psoe: .20, pp: .45, vox: .30, sumar: .02, podemos: .01, otros: .02 } },
    { id: "melilla",   name: "Melilla",          label: "Melilla",          w: 0.09, b: { psoe: .22, pp: .44, vox: .28, sumar: .03, podemos: .01, otros: .02 } }
  ];
  const REGION_MAP = Object.fromEntries(REGIONS.map(r => [r.id, r]));

  // etiqueta geográfica normalizada → id de sector
  const REGION_KEYS = {
    andalucia: "andalucia", aragon: "aragon", principadodeasturias: "asturias",
    illesbalears: "baleares", canarias: "canarias", cantabria: "cantabria",
    castillalamancha: "clm", castillayleon: "cleon", catalunacatalunya: "cataluna",
    comunitalvalenciana: "cvalenciana", comunitatvalenciana: "cvalenciana",
    extremadura: "extremadura", galicia: "galicia", comunidaddemadrid: "madrid",
    regiondemurcia: "murcia", comunidadforaldenavarra: "navarra",
    paisvascoeuskadi: "paisvasco", larioja: "larioja",
    ciudadautonomadeceuta: "ceuta", ciudadautonomademelilla: "melilla"
  };

  // alias de ciudades / topónimos (para inferir sector en tweets reales)
  const PLACE_ALIASES = {
    madrid: "madrid", alcala: "madrid", getafe: "madrid", leganes: "madrid", mostoles: "madrid",
    barcelona: "cataluna", girona: "cataluna", tarragona: "cataluna", lleida: "cataluna", badalona: "cataluna", sitges: "cataluna",
    valencia: "cvalenciana", castellon: "cvalenciana", castellón: "cvalenciana", alicante: "cvalenciana", elche: "cvalenciana", torrevieja: "cvalenciana",
    sevilla: "andalucia", malaga: "andalucia", málaga: "andalucia", granada: "andalucia", cordoba: "andalucia", córdoba: "andalucia",
    cadiz: "andalucia", cádiz: "andalucia", almeria: "andalucia", almería: "andalucia", huelva: "andalucia", jaen: "andalucia", jaén: "andalucia",
    zaragoza: "aragon", huesca: "aragon", teruel: "aragon",
    oviedo: "asturias", gijon: "asturias", gijón: "asturias",
    palma: "baleares", ibiza: "baleares", ibiza: "baleares", menorca: "baleares",
    laspalmas: "canarias", santacruzdetenerife: "canarias", tenerife: "canarias", grancanaria: "canarias", fuerteventura: "canarias", lanzarote: "canarias",
    santander: "cantabria",
    toledo: "clm", albacete: "clm", ciudadreal: "clm", cuenca: "clm", guadalajara: "clm", talavera: "clm",
    valladolid: "cleon", burgos: "cleon", salamanca: "cleon", leon: "cleon", zamora: "cleon", palencia: "cleon", segovia: "cleon", soria: "cleon", avila: "cleon",
    hospitalet: "cataluna",
    badajoz: "extremadura", merida: "extremadura", caceres: "extremadura",
    aCoruna: "galicia", coruna: "galicia", vigo: "galicia", santiago: "galicia", ourense: "galicia", lugo: "galicia", pontevedra: "galicia",
    murcia: "murcia", cartagena: "murcia",
    pamplona: "navarra", iruna: "navarra",
    bilbao: "paisvasco", donostia: "paisvasco", sansebastian: "paisvasco", vitoria: "paisvasco", gasteiz: "paisvasco",
    logrono: "larioja",
    ceuta: "ceuta", melilla: "melilla"
  };

  /* ── TEXTOS DE LA SIMULACIÓN ────────────────────────────── */
  const TOPICS = [
    "la vivienda", "la sanidad", "la inflación", "los salarios", "la factura de la luz",
    "la educación pública", "el paro juvenil", "la lista de espera sanitaria", "el precio del alquiler",
    "los impuestos", "la corrupción", "la inmigración", "las pensiones", "la seguridad ciudadana",
    "la industria nacional", "la sequía", "la deuda pública", "la despoblación rural",
    "el sistema de pensiones", "la financiación autonómica", "la reforma constitucional", "la delincuencia"
  ];

  const TEMPLATES = [
    // ── indignación / crítica ──
    { s: "neg", t: "Basta ya. {topic} lleva años igual y {tag} sigue prometiendo. ¿Hasta cuándo? 😤" },
    { s: "neg", t: "Si esto es gobernar, que alguien me lo explique. Con {topic} así, no me extraña que la gente esté harta. {tag}" },
    { s: "neg", t: "Nuevo récord en {topic} y ni una sola comparecencia. El silencio de {tag} dice mucho." },
    { s: "neg", t: "No hay presupuesto que aguante {topic} mientras se gastan en chapuzas. {tag} debería dar explicaciones." },
    { s: "neg", t: "En {region} se cierran servicios y ellos hablan de {topic} como si nada. {tag} 🤦" },
    { s: "neg", t: "Tres comparecencias, cero datos y la misma cantarella sobre {topic}. {tag}" },
    { s: "neg", t: "Aquí, en {region}, la gente no puede pagar el alquiler y a {tag} le preocupa la polémica de la semana." },
    { s: "neg", t: "Menos eslóganes y más {topic}. {tag} nos debe una respuesta." },
    { s: "neg", t: "Otro caso con {topic} y otra vez culpando al anterior. Llevan años con la misma canción. {tag}" },
    { s: "neg", t: "Cuando {topic} sube es «herencia»; cuando baja es «gestión». Vaya memoria selectiva, {tag}." },
    { s: "neg", t: "Hartos de que {topic} sea noticia todos los días sin solución. {tag}, ¿algún plan real?" },
    { s: "neg", t: "Otra vez la tele centrada en la bronca y {topic} sin aparecer. Buen trabajo, {tag}." },
    { s: "neg", t: "Récord histórico en {topic} y campaña de comunicación. Prioridades, ¿verdad, {tag}?" },

    // ── apoyo ──
    { s: "pos", t: "Enhorabuena a {tag} por mover {topic} un {pct}%. Así sí se hacen las cosas. 👏" },
    { s: "pos", t: "Lo que nadie cuenta: en {region} {topic} mejora y se agradece. Buen trabajo, {tag}." },
    { s: "pos", t: "Apoyo total a {tag} frente a la fake news sobre {topic}. Los datos mandan. 📊" },
    { s: "pos", t: "Gracias {tag} por escuchar a {region}, por fin hay esperanza con {topic}." },
    { s: "pos", t: "Así se defiende a la gente: {tag} presenta su plan de {topic} y con números. 💪" },
    { s: "pos", t: "Mi familia llevaba años sin creer en nadie y hoy apoya a {tag} por {topic}. Se agradece." },
    { s: "pos", t: "Primera vez que veo un debate de {topic} sin mentiras. Puntos para {tag}. ✅" },

    // ── neutro / pregunta ──
    { s: "neu", t: "¿Alguien tiene datos reales sobre {topic}? Solo veo titulares de {tag} y de la oposición. 🤔" },
    { s: "neu", t: "Pregunta seria: ¿qué propone exactamente {tag} con {topic}? No encuentro el programa." },
    { s: "neu", t: "Hoy toca debate de {topic}. A ver si esta vez hay cifras y no solo gritos. {tag}" },
    { s: "neu", t: "Comparativa de {topic} entre partidos, sin filtro. Decid vosotros. 📈 {tag}" },
    { s: "neu", t: "Encuesta rápida: ¿quién lleva razón en {topic}? {tag} dice una cosa, la contraria otra." },
    { s: "neu", t: "Hilo con lo que dijeron ayer sobre {topic} vs lo que dicen hoy. {tag}. 🧵" },
    { s: "neu", t: "Desde {region}: la calle habla de {topic} muy distinto a la tele. Y sí, salió {tag} en la conversación." },
    { s: "neu", t: "Voy a escuchar el debate de {topic} con papel y boli. Si {tag} cumple, lo firmo." },
    { s: "neu", t: "Datos oficiales: {topic} varía un {pct}% según la comunidad. {tag}, ¿cómo lo explica?" },
    { s: "neu", t: "Nadie habla de {topic} en prime time, así que lo decimos aquí. Atención a {region}, {tag}." },
    { s: "neu", t: "Tercera semana con {topic} en portada y ni una respuesta clara. {tag} 🍿" },
    { s: "neu", t: "Primera vez que voto y mi duda es {topic}. ¿{tag} convence o no? Pregunto sin broma." },

    // ── movilización / viral ──
    { s: "neg", t: "Manifiestación este sábado en {region} por {topic}. Allí estaremos, {tag} o no. ✊" },
    { s: "pos", t: "Comparte si crees que {topic} merece estar en la agenda de {tag}. Vamos a hacer ruido." },
    { s: "neu", t: "Hoy se vota en {region}. Si te importa {topic}, piénsalo bien antes de tuitear. {tag}" },
    { s: "neu", t: "Reto viral: resume en un tuit la propuesta de {tag} sobre {topic}. Yo empiezo…" },
    { s: "neg", t: "Si esto no es un escándalo con {topic}, ¿qué lo es? {tag} tendrá que explicarlo." }
  ];

  const POS_WORDS = ["gracias", "enhorabuena", "apoyo", "bueno", "esperanza", "fuerza", "acuerdo", "mejora", "victoria", "bravo"];
  const NEG_WORDS = ["escándalo", "corrupto", "dimisión", "mentira", "tontería", "inútil", "chapuza", "fraude", "indignante", "harto", "basura", "resignación"];

  /* ── USUARIOS SIMULADOS ─────────────────────────────────── */
  const FIRST = ["María","Lucía","Javier","Ana","Pablo","Sara","Diego","Nerea","Iván","Clara","Miguel","Elena","Hugo","Nuria","Álvaro","Irene","Raúl","Paula","Óscar","Marta","Unai","Laura","Rubén","Sofía","Adrián","Carmen","Víctor","Teresa","Jorge","Ainhoa","Borja","Lorena","Ismael","Julia","Dani","Rocío","Enrique","Miriam","Alba","Sergio"];
  const LAST = ["García","Martínez","López","Sánchez","Fernández","Gómez","Ruiz","Díaz","Moreno","Álvarez","Romero","Navarro","Iglesias","Ortega","Ramos","Torres","Delgado","Castro","Herrera","Vázquez","Méndez","Peña","Cruz","Reyes","Aguilar","Cano","Bermúdez","Ferrer","Gil","Serrano","Vidal","Blanco","Molina","Suarez","Suárez","Prieto","Carrasco","Ballesteros","Quintana","Otxoa"];
  const CITYISH = ["del Valle","de la Cruz","el Lobo","Torres","Rivas","Santos","Núñez","Corrales","Ávila","Mena"];

  /* ── utilidades compartidas ─────────────────────────────── */
  function norm(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  }
  function slug(s) { return norm(s).replace(/\s+/g, ""); }

  return {
    PARTIES, PARTY_MAP, REGIONS, REGION_MAP, REGION_KEYS, PLACE_ALIASES,
    TOPICS, TEMPLATES, POS_WORDS, NEG_WORDS,
    FIRST, LAST, CITYISH, norm, slug,
    // compartir por socket: identidad nacional aproximada del simulador
    BASE_SHARE: { psoe: .27, pp: .33, vox: .18, sumar: .08, podemos: .04, otros: .10 }
  };
})();
