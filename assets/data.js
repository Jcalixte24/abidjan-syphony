/* ================== CONTENU MODIFIABLE ================== */

// Rendez-vous (heure d'Abidjan = UTC)
const EVENT_START = new Date('2026-11-13T08:30:00Z');

// Masterclass : 5 thématiques, 12 places chacune (60 places au total).
// Source : présentation BOMLAAH, édition 1.
const THEMES = [
  { id:'droits', art:'economie', tag:"Droits d'auteur et économie des ICC",
    title:"Droits d'auteur et économie des industries culturelles et créatives",
    text:"Les droits d'auteur et l'économie des industries culturelles et créatives (ICC).",
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
  { id:'mickaelle-ondo', name:'Mickaelle Ondo', role:'Fondatrice de Royalties Lab', photo:'img/intervenants/mickaelle-ondo.jpg', bio:["Mickaelle Ondo est fondatrice de Royalties Lab, une initiative spécialisée dans l’administration des droits musicaux, la documentation des catalogues, les métadonnées et la traçabilité des royalties.", "Forte de 15 années d’expérience dans l’industrie musicale et audiovisuelle, notamment auprès de PRS for Music, Kobalt Music, Sony Music Entertainment et BBC Studios au Royaume-Uni, elle travaille aujourd’hui sur les enjeux de documentation, de gestion des droits et de structuration des actifs culturels à l’ère numérique.", "Elle développe également Royalties Lab Learning, le pôle formation de Royalties Lab, dédié au développement de compétences professionnelles dans ces domaines."] },
  { id:'assi-mida', name:'Assi Mida', role:'Compositeur', photo:'img/intervenants/assi-mida.jpg', bio:["Je me nomme Mida Assi Mathieu. Je suis compositeur de musique à l’image, sound designer et ingénieur du son ivoirien. Diplômé en Musicologie de l’INSAAC, je développe une approche où la musique dépasse sa fonction d’accompagnement pour devenir un véritable langage narratif, au service de l’émotion, de l’identité des personnages et du récit.", "À travers Blackbox Sound, le studio que j’ai fondé, j’ai eu l’opportunité de composer ou de diriger la création sonore de plusieurs productions audiovisuelles, parmi lesquelles Docteur Wlika, Obatanga (Canal+ Original), La Dernière Voix, YA Braquage au Village, Bernard Dadié, un homme de liberté…", "Mon travail s’inscrit dans une recherche permanente d’un dialogue entre les écritures cinématographiques contemporaines et les patrimoines musicaux africains. J’aime créer des identités sonores qui racontent autant qu’elles accompagnent l’image, en faisant de la musique un acteur à part entière de la narration.", "Aujourd’hui, je souhaite poursuivre cette démarche en l’enrichissant de nouvelles rencontres artistiques et de nouvelles formes d’écriture au service du cinéma africain."] },
  { id:'florent-galaty', name:'Florent Galaty', role:'Professionnel des ICC ivoiriennes', photo:null, bio:'' },
  { id:'ani-eliam', name:'Ani Eliam', role:'Productrice et scénariste', photo:'img/intervenants/ani-eliam.jpg', bio:["Eliam Ani, scénariste ivoirienne, s’est d’abord orientée vers le marketing et le management, obtenant un master dans ces domaines avant d’opérer un virage à 360° vers le monde du cinéma. Forte de sa passion pour l’écriture, elle a contribué à plusieurs séries africaines à succès.", "En 2021, elle coécrit les saisons 1 et 2 de la série d’animation Kenda, une œuvre acclamée, nominée au Festival d’Annecy et à Vue d’Afrique la même année, et couronnée du prix Best Africa Rising Film au Black Star International Film Festival au Ghana.", "En juillet 2023, ETERNEL, son premier long-métrage coécrit, est diffusé dans les salles Majestic en Côte d’Ivoire. Ce film a reçu des nominations prestigieuses, notamment aux NISA 2023, LFC Awards 2023, et au Pan African Film Festival d’Hollywood.", "Depuis 2022, Ani dirige Booya Studios, un studio spécialisé dans la production de contenu d’animation 2D et 3D. Le premier projet de série développé par le studio, Le Monde Selon Jingho, lui a valu la prestigieuse bourse Mandela Washington Fellowship en 2022. Le studio a également marqué sa présence au MIFA Pitch du Festival d’Annecy pendant deux années consécutives, avec un long métrage d’animation franco-ivoirien en développement, et le court métrage Moyo l’île du cœur, récompensé lors du concours Boost’Anim 2024."] },
  { id:'illman-toure', name:'Illman Touré', role:'Compositeur', photo:null, bio:'' },
  { id:'ohouot-assi', name:'Ohouot Assi', role:'Réalisateur', photo:'img/intervenants/ohouot-assi.jpg', bio:["Ohouot Assi Gilbert Philippe, dit O. Assi, est titulaire d’une Maîtrise en Arts du Spectacle, option Cinéma, obtenue à l’UFR Informations Communication et Arts de l’Université Félix Houphouët-Boigny. Il développe une écriture engagée, nourrie par les réalités sociales africaines et l’héritage des pionniers du cinéma ivoirien.", "En 2023, Taxi Warren marque un tournant avec le Prix de la meilleure fiction Babiwood au FESTILAG 2023. En 2025, La Coach confirme son rayonnement international à travers plusieurs distinctions, tandis qu’Amlan reçoit le Bantu de Bronze au Festival Bangui fait son cinéma.", "Co-fondateur de la société de production Incrust’, il poursuit une exploration des fractures humaines et sociales. Depuis le 25 janvier 2026, La Coach est diffusée sur la Radiodiffusion Télévision Ivoirienne.", "Sa vision : utiliser le cinéma pour révéler les blessures invisibles et contribuer à la transformation des consciences."] },
  { id:'mathieu', name:'Mathieu', role:'Compositeur', photo:null, bio:'' }
];

// Envoi des formulaires par WhatsApp (repli quand le système de réservation Google n'est pas branché).
const WHATSAPP = { masterclass:'+33745446404', cineconcert:'+33745446404' };
