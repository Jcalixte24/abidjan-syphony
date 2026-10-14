/* ================== CONTENU MODIFIABLE ================== */

// Rendez-vous (heure d'Abidjan = UTC)
const EVENT_START = new Date('2026-11-13T08:30:00Z');

// Masterclass : 5 thématiques, 12 places chacune (60 places au total).
// Source : présentation BOMLAAH, édition 1.
const THEMES = [
  { id:'droits', art:'economie', tag:"Droits d'auteur et économie",
    title:"Droits d'auteur et économie de la création",
    text:"Droits d'auteur et économie de la création.",
    intervenants:['mickaelle-ondo'] },
  { id:'compositeur', art:'compositeur', tag:'Le métier de compositeur',
    title:"Le métier de compositeur de musique à l'image",
    text:"Le métier de compositeur de musique à l'image.",
    intervenants:['assi-mida'] },
  { id:'carriere', art:'carrieres', tag:'Carrière',
    title:"Opportunités de carrière",
    text:"Les opportunités de carrière dans les industries culturelles et créatives ivoiriennes.",
    intervenants:['florent-galaty'] },
  { id:'animation', art:'binome', tag:'Binôme · film d’animation',
    title:"Réalisateur et compositeur : le film d'animation",
    text:"Comment un réalisateur et un compositeur construisent ensemble l'univers d'un film d'animation.",
    intervenants:['ani-eliam','illman-toure'] },
  { id:'fiction', art:'binome', tag:'Binôme · film de fiction',
    title:"Compositeur et réalisateur : le film de fiction",
    text:"Le dialogue entre compositeur et réalisateur sur un film de fiction, de l'idée à la partition.",
    intervenants:['ohouot-assi','mathieu'] }
];

// Intervenants (7). Ajoutez « photo » (URL) et « bio » (une ou deux phrases) pour les afficher.
const INTERVENANTS = [
  { id:'mickaelle-ondo', name:'Mickaelle Ondo', role:'Fondatrice de Royalties Lab', photo:null, bio:'' },
  { id:'assi-mida', name:'Assi Mida', role:'Compositeur', photo:null, bio:'' },
  { id:'florent-galaty', name:'Florent Galaty', role:'Professionnel des ICC ivoiriennes', photo:null, bio:'' },
  { id:'ani-eliam', name:'Ani Eliam', role:'Productrice et scénariste', photo:null, bio:'' },
  { id:'illman-toure', name:'Illman Touré', role:'Compositeur', photo:null, bio:'' },
  { id:'ohouot-assi', name:'Ohouot Assi', role:'Réalisateur', photo:null, bio:'' },
  { id:'mathieu', name:'Mathieu', role:'Compositeur', photo:null, bio:'' }
];

// Envoi des formulaires par WhatsApp (repli quand le système de réservation Google n'est pas branché).
const WHATSAPP = { masterclass:'+33745446404', cineconcert:'+33745446404' };
