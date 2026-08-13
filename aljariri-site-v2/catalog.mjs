export const PRODUCTS = [
  {
    id: 'lezione-individuale-1h',
    slug: 'lezione-individuale-arabo-1-ora',
    name: 'Lezione individuale di arabo — 1 ora',
    short: 'Una lezione 1:1 online o in sede, costruita sul tuo livello e sul tuo obiettivo.',
    category: 'Lezioni',
    format: 'Roma + Online',
    price: 20,
    compareAt: 30,
    glyph: 'ع',
    accent: 'coral',
    details: ['60 minuti 1:1', 'Online o in presenza', 'Materiale didattico incluso', 'Orario concordabile']
  },
  {
    id: 'corso-individuale-15h',
    slug: 'corso-individuale-arabo-15-ore',
    name: 'Corso individuale di arabo — 15 ore',
    short: 'Percorso personalizzato per iniziare, riprendere o sbloccare conversazione e grammatica.',
    category: 'Corsi',
    format: 'Roma + Online',
    price: 240,
    compareAt: 450,
    glyph: '15',
    accent: 'green',
    details: ['15 ore individuali', 'Piano personalizzato', 'Arabo moderno o focus specifico', 'Materiale incluso']
  },
  {
    id: 'corso-individuale-30h',
    slug: 'corso-individuale-arabo-30-ore',
    name: 'Corso individuale di arabo — 30 ore',
    short: 'Percorso ad alta continuità per costruire basi solide e accelerare il livello.',
    category: 'Corsi',
    format: 'Roma + Online',
    price: 300,
    compareAt: 900,
    glyph: '30',
    accent: 'gold',
    details: ['30 ore individuali', 'Percorso progressivo', 'Conversazione + grammatica', 'Materiale incluso']
  },
  {
    id: 'traduzione-250-parole',
    slug: 'traduzione-cartella-250-parole',
    name: 'Traduzione — cartella da 250 parole',
    short: 'Traduzione professionale di una cartella. Per pratiche complesse richiedi prima un preventivo.',
    category: 'Traduzioni',
    format: 'Servizio documentale',
    price: 15,
    compareAt: 30,
    glyph: 'تر',
    accent: 'violet',
    details: ['Fino a 250 parole', 'Arabo ↔ Italiano', 'Consegna digitale', 'Preventivo per asseverazione/legalizzazione']
  }
];

export const byId = id => PRODUCTS.find(p => p.id === id);
