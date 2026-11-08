// Avatars champignons en 3D (three.js) : modèles par espèce, visage, accessoires, animations,
// et rendus PNG mis en cache pour les marqueurs de la carte et les listes.
import * as THREE from '../vendor/three.module.min.js';

export const CAPS = {
  cepe: { n: 'Cèpe', tints: ['#7A4A2A', '#9C6436', '#5A3820'], under: '#E2CE78', stem: '#EFE3C6', shape: 'dome' },
  bai: { n: 'Bolet bai', tints: ['#6A3B22', '#80492B', '#4C2B18'], under: '#E7D265', stem: '#DCC59B', shape: 'cushion' },
  girolle: { n: 'Girolle', tints: ['#F0A033', '#F6B84E', '#DE8A1F'], under: '#F2A740', stem: '#F4B04A', shape: 'funnel' },
  trompette: { n: 'Trompette', tints: ['#2D2A30', '#46404C', '#1D1B20'], under: '#76727C', stem: '#55505C', shape: 'horn' },
  morille: { n: 'Morille', tints: ['#B48A57', '#99703F', '#CDA66E'], under: '#B48A57', stem: '#F0E7D3', shape: 'cone' },
  piedbleu: { n: 'Pied bleu', tints: ['#8D6FB7', '#A68BCB', '#6E5497'], under: '#C8B5E2', stem: '#B9A1DA', shape: 'convex' },
  coulemelle: { n: 'Coulemelle', tints: ['#D7C29F', '#E4D4B6', '#C6AE86'], under: '#F2ECDF', stem: '#E7DDC9', shape: 'parasol' },
  cesar: { n: 'Amanite des Césars', tints: ['#EC7A1E', '#F28E36', '#D8640F'], under: '#F5D25A', stem: '#F5D25A', shape: 'hemi', volva: true },
  hydne: { n: 'Pied de mouton', tints: ['#E7C89A', '#EDD5AE', '#D9B27C'], under: '#F1DDBB', stem: '#F3E6CF', shape: 'wavy' },
  tube: { n: 'Chanterelle en tube', tints: ['#6B5641', '#7F6850', '#54412F'], under: '#C9A15A', stem: '#E2AE48', shape: 'funnel' },
  lactaire: { n: 'Lactaire délicieux', tints: ['#E2793A', '#EA8D52', '#C96526'], under: '#EE9A5C', stem: '#EBA26A', shape: 'convex' },
  pleurote: { n: 'Pleurote', tints: ['#8C847A', '#A39A8E', '#6F675E'], under: '#EDE8DF', stem: '#ECE5D8', shape: 'wavy' },
  mousseron: { n: 'Mousseron', tints: ['#EFE6D0', '#E6D8B8', '#F5EFE2'], under: '#F6F1E6', stem: '#F4EEE2', shape: 'convex' },
  rose: { n: 'Rosé des prés', tints: ['#F3EFE7', '#E9E1D3', '#FBF8F2'], under: '#E39A98', stem: '#F6F2EA', shape: 'hemi' },
  russule: { n: 'Russule charbonnière', tints: ['#6C6893', '#7B8A6A', '#5A4F78'], under: '#F2EFE6', stem: '#F4F2EC', shape: 'convex' },
  sparassis: { n: 'Sparassis crépu', tints: ['#E6D49C', '#EEDFB2', '#D8C17C'], under: '#E6D49C', stem: '#E9DBAA', shape: 'wavy' },
  // espèces ajoutées au Mycodex (av: false = pas proposé comme avatar). ring : anneau · volva : volve · dots : ponctuations du pied
  // tex : 'spots' (taches, verrues, plaques : couleur spot) ou 'scales' (mèches : couleur scale) · stemH : pied plus long
  coprin: { n: 'Coprin chevelu', tints: ['#F4F0E6', '#EEE8DA', '#F8F5EE'], under: '#E8E2D6', stem: '#F6F3EC', shape: 'bell', tex: 'scales', scale: '#B49A7B', ring: '#F3EFE6' },
  tuemouche: { n: 'Amanite tue-mouches', tints: ['#D42A1F', '#E2402E', '#BF1F15'], under: '#F8F5EE', stem: '#F6F3EC', shape: 'hemi', tex: 'spots', spot: '#FFFFFF', ring: '#F8F5EE', volva: true },
  pied_rouge: { n: 'Bolet à pied rouge', tints: ['#5E3B26', '#6E4830', '#4D2F1E'], under: '#C9361F', stem: '#E2B23A', dots: '#B8281A', shape: 'dome' },
  laccaire: { n: 'Laccaire améthyste', tints: ['#7C4A9C', '#8D5DAE', '#6B3D8A'], under: '#946AB8', stem: '#8A63A6', shape: 'wavy' },
  vesse: { n: 'Vesse-de-loup géante', tints: ['#F3F1EA', '#ECE8DD', '#F8F7F2'], under: '#F3F1EA', stem: '#F3F1EA', shape: 'ball', av: false },
  hygrophore: { n: 'Hygrophore de mars', tints: ['#55575C', '#6B6D72', '#45474C'], under: '#DCDAD4', stem: '#ECEAE5', shape: 'convex', av: false },
  marasme: { n: 'Marasme des Oréades', tints: ['#D8B98C', '#E2C79F', '#C9A676'], under: '#EEE2CC', stem: '#E6D6BA', shape: 'conic', av: false },
  leccinum: { n: 'Bolet orangé', tints: ['#D4632A', '#DE7638', '#C1531F'], under: '#E9E2D4', stem: '#EEE8DC', dots: '#3A2A22', shape: 'dome', av: false },
  russule_verte: { n: 'Russule verdoyante', tints: ['#8DA676', '#9CB485', '#7E9767'], under: '#F4F1E7', stem: '#F6F4EE', shape: 'convex', tex: 'spots', spot: '#BFCDAA', av: false },
  bolet_jaune: { n: 'Bolet jaune', tints: ['#6E4322', '#7E5130', '#5E381C'], under: '#E3C445', stem: '#EADFA6', ring: '#9C86B0', shape: 'cushion', av: false },
  polypore_soufre: { n: 'Polypore soufré', tints: ['#F0A23A', '#F5B54E', '#E48C25'], under: '#F6DF55', stem: '#6E5A46', shape: 'shelf', shelves: 3, av: false },
  langue_boeuf: { n: 'Langue de bœuf', tints: ['#A3342A', '#B64437', '#8E2920'], under: '#EBCDAF', stem: '#6A5643', shape: 'shelf', shelves: 1, thick: 1.4, av: false },
  oreille_judas: { n: 'Oreille de Judas', tints: ['#74402A', '#865036', '#62341F'], under: '#9A6650', stem: '#7A6B5C', shape: 'shelf', shelves: 2, thick: 0.7, av: false },
  armillaire: { n: 'Armillaire', tints: ['#C99846', '#D6AA5A', '#B98838'], under: '#F0E4CB', stem: '#D7BF95', ring: '#F1E8D3', shape: 'convex', tex: 'spots', spot: '#8A6438', av: false },
  truffe: { n: 'Truffe', tints: ['#2B2522', '#36302C', '#221D1A'], under: '#2B2522', stem: '#2B2522', shape: 'ball', tex: 'spots', spot: '#5A4F48', av: false },
  phalloide: { n: 'Amanite phalloïde', tints: ['#B9B57A', '#C8C48F', '#A8A56B'], under: '#F7F5EE', stem: '#F3F1E6', ring: '#F7F5EE', volva: true, shape: 'hemi', av: false },
  amanite_blanche: { n: 'Amanite blanche', tints: ['#F5F3EE', '#EEEBE4', '#FAF9F6'], under: '#FAF9F6', stem: '#F7F5F0', ring: '#FAF9F6', volva: true, shape: 'hemi', av: false },
  panthere: { n: 'Amanite panthère', tints: ['#7B5C3E', '#8C6C4C', '#6A4D32'], under: '#F6F3EC', stem: '#F4F1EA', ring: '#F6F3EC', volva: true, shape: 'convex', tex: 'spots', spot: '#F7F4EC', av: false },
  cortinaire: { n: 'Cortinaire', tints: ['#B66A33', '#C47B42', '#A35B2A'], under: '#9A5A30', stem: '#C88E55', shape: 'conic', av: false },
  lepiote: { n: 'Petite lépiote', tints: ['#EADDD3', '#F0E6DE', '#E0D0C4'], under: '#F5F0EA', stem: '#E8D8CC', shape: 'parasol', scale: '#8E4B3C', stemH: 0.75, av: false },
  galere: { n: 'Galère marginée', tints: ['#B97A3C', '#C78B4C', '#A86C30'], under: '#B88A50', stem: '#A98560', ring: '#7E5D3C', shape: 'convex', av: false },
  gyromitre: { n: 'Gyromitre', tints: ['#7C3D27', '#8E4C31', '#6A321F'], under: '#7C3D27', stem: '#F0EAE0', shape: 'brain', av: false },
  entolome: { n: 'Entolome livide', tints: ['#D3CCBF', '#DDD7CC', '#C7BFB1'], under: '#E8C8B6', stem: '#F1EDE6', shape: 'convex', av: false },
  olivier: { n: 'Clitocybe de l\'olivier', tints: ['#E87A2A', '#F08C3C', '#D96A1E'], under: '#F29236', stem: '#E98A3A', shape: 'funnel', av: false },
  faussegirolle: { n: 'Fausse girolle', tints: ['#E6852C', '#EE973E', '#D7741F'], under: '#F19A3A', stem: '#E08A36', shape: 'funnel', av: false },
  satan: { n: 'Bolet de Satan', tints: ['#DCD8CB', '#E6E2D7', '#CFCABB'], under: '#C9321F', stem: '#D65A3A', dots: '#9E2214', shape: 'dome', av: false },
  amer: { n: 'Bolet amer', tints: ['#A97C52', '#B88C62', '#987044'], under: '#E8C6BE', stem: '#CDAF86', dots: '#7A5A3A', shape: 'dome', av: false },
  clitoblanc: { n: 'Clitocybe blanc', tints: ['#EEEDE8', '#E6E4DE', '#F5F4F0'], under: '#F2F0EA', stem: '#EEEDE8', shape: 'wavy', av: false },
  inocybe: { n: 'Inocybe', tints: ['#E8D8C6', '#EFE3D4', '#DCC8B2'], under: '#C9A98C', stem: '#EFE3D6', shape: 'conic', av: false },
  equestre: { n: 'Tricholome équestre', tints: ['#D7BE45', '#E2CC5E', '#C7AC35'], under: '#F0DD55', stem: '#E9D873', shape: 'convex', av: false },
  paxille: { n: 'Paxille enroulé', tints: ['#8E6B47', '#A07B55', '#7C5C3B'], under: '#B88E5B', stem: '#9E7C58', shape: 'funnel', av: false },
  hypholome: { n: 'Hypholome en touffe', tints: ['#E2C13A', '#EBCF55', '#D2AE2C'], under: '#A8A64A', stem: '#E0C755', shape: 'convex', av: false },
  jaunissant: { n: 'Agaric jaunissant', tints: ['#F2EEE6', '#E9E4DA', '#F8F6F1'], under: '#D9A6A0', stem: '#F4F1EA', ring: '#F7F4EE', shape: 'hemi', av: false },
  toison: { n: 'Lactaire à toison', tints: ['#E7A595', '#EFB6A8', '#DC9280'], under: '#F3E3D8', stem: '#EED8CC', shape: 'funnel', av: false },
  emetique: { n: 'Russule émétique', tints: ['#D7262D', '#E33A40', '#C41D24'], under: '#F7F5EF', stem: '#F8F7F3', shape: 'convex', av: false },
  clitocybe_nebuleux: { n: 'Clitocybe nébuleux', tints: ['#A9A59D', '#B9B5AD', '#98948C'], under: '#EDE5D0', stem: '#E3DFD4', shape: 'convex', av: false },
  scleroderme: { n: 'Scléroderme', tints: ['#D2AD5A', '#DCBB6C', '#C59D4A'], under: '#D2AD5A', stem: '#D2AD5A', shape: 'ball', tex: 'spots', spot: '#86602F', av: false },
  mycene_pure: { n: 'Mycène pure', tints: ['#C9A1C6', '#D4B0D2', '#BD92BA'], under: '#E8D6E6', stem: '#CFB0CC', shape: 'conic', av: false },
  amanite_citrine: { n: 'Amanite citrine', tints: ['#E6DF9E', '#EDE7B2', '#DDD58A'], under: '#FAF8EE', stem: '#F6F3E6', ring: '#F7F4E8', volva: true, shape: 'hemi', tex: 'spots', spot: '#EFE9D2', av: false },
  amadouvier: { n: 'Amadouvier', tints: ['#8E8C87', '#A3A19B', '#7A7873'], under: '#C9B597', stem: '#8B7B66', shape: 'shelf', shelves: 2, thick: 1.8, av: false },
  satyre: { n: 'Satyre puant', tints: ['#4D4E2C', '#5C5D36', '#3F4023'], under: '#4D4E2C', stem: '#F4F1E8', shape: 'cone', stemH: 1.7, volva: true, av: false },
  anthurus: { n: 'Anthurus d\'Archer', tints: ['#D9302A', '#E5463C', '#C4231E'], under: '#D9302A', stem: '#EEE8DE', shape: 'star', av: false },
  polypore_ombelle: { n: 'Polypore en ombelle', tints: ['#A89A86', '#B8AB97', '#968874'], under: '#F2EEE6', stem: '#F1ECE2', shape: 'wavy', av: false },
  poule_bois: { n: 'Polypore en touffe', tints: ['#857563', '#978672', '#736453'], under: '#EFEBE3', stem: '#ECE6DA', shape: 'shelf', shelves: 3, thick: 0.8, av: false },
  hydne_herisson: { n: 'Hydne hérisson', tints: ['#F4F1E8', '#ECE7DA', '#F8F6F0'], under: '#F4F1E8', stem: '#F4F1E8', shape: 'ball', tex: 'spots', spot: '#E2DCCB', av: false },
  pholiote_ridee: { n: 'Pholiote ridée', tints: ['#D3B06E', '#DDBE82', '#C49F5C'], under: '#B98A4E', stem: '#EFE6D3', ring: '#F5F0E6', shape: 'convex', tex: 'spots', spot: '#EDE6D6', av: false },
  tete_moine: { n: 'Clitocybe géotrope', tints: ['#E3CDA6', '#EAD8B7', '#D7BE93'], under: '#F1E6D0', stem: '#E6D3B2', shape: 'funnel', av: false },
  pied_violet: { n: 'Pied violet', tints: ['#CFC3B4', '#DBD0C3', '#C2B5A5'], under: '#E9DCD3', stem: '#9C7FC0', shape: 'convex', av: false },
  tricholome_pretentieux: { n: 'Tricholome prétentieux', tints: ['#5E5F63', '#717276', '#4D4E52'], under: '#EDE7C8', stem: '#EFEBD8', shape: 'convex', av: false },
  lactaire_sanguin: { n: 'Lactaire sanguin', tints: ['#C77857', '#D38B6B', '#B5664A'], under: '#C98A7B', stem: '#B86F64', shape: 'funnel', av: false },
  vachotte: { n: 'Lactaire à lait abondant', tints: ['#B8662F', '#C77A43', '#A65624'], under: '#EEDFC6', stem: '#CF935E', shape: 'convex', av: false },
  russule_vesca: { n: 'Russule comestible', tints: ['#C48A85', '#CF9C97', '#B47873'], under: '#F6F3EC', stem: '#F7F5F0', shape: 'convex', av: false },
  hygrophore_pres: { n: 'Hygrophore des prés', tints: ['#E39A55', '#EAAB6B', '#D68A45'], under: '#F0C795', stem: '#EDCB9E', shape: 'conic', av: false },
  pleurote_panicaut: { n: 'Pleurote du panicaut', tints: ['#A88F73', '#B9A186', '#977F64'], under: '#EFE6D6', stem: '#F1EBE0', shape: 'funnel', av: false },
  pleurote_corne: { n: 'Pleurote corne d\'abondance', tints: ['#D8C6A4', '#E2D2B6', '#CBB692'], under: '#F3EDE1', stem: '#EEE6D7', shape: 'funnel', av: false },
  collybie_velue: { n: 'Collybie à pied velouté', tints: ['#D07A2A', '#DB8D3F', '#BF6A1E'], under: '#F1DFA8', stem: '#5A3A28', shape: 'convex', av: false },
  agaric_jacheres: { n: 'Agaric des jachères', tints: ['#F5F2EA', '#ECE7DB', '#FAF8F3'], under: '#B78C76', stem: '#F6F3EC', ring: '#F7F4EE', shape: 'hemi', av: false },
  agaric_auguste: { n: 'Agaric auguste', tints: ['#C69A57', '#D3AB6B', '#B88B48'], under: '#9E7663', stem: '#F4F0E6', ring: '#F7F4EE', shape: 'hemi', tex: 'scales', scale: '#8A5F2E', av: false },
  lepiote_deguenillee: { n: 'Lépiote déguenillée', tints: ['#C9A884', '#D6B896', '#BB9774'], under: '#F5F1EA', stem: '#EDE3D6', shape: 'parasol', scale: '#6E4A2E', stemH: 0.8, av: false },
  morillon: { n: 'Morillon', tints: ['#8C6B45', '#9C7A52', '#7C5D3A'], under: '#8C6B45', stem: '#F1EADB', shape: 'cone', stemH: 1.4, av: false },
  pezize_orangee: { n: 'Pézize orangée', tints: ['#F27A1A', '#F68E35', '#E06A10'], under: '#F6B57A', stem: '#F6B57A', shape: 'funnel', stemH: 0.2, av: false },
  bolet_bouviers: { n: 'Bolet des bouviers', tints: ['#C98E57', '#D49F6B', '#BA7E48'], under: '#B9A456', stem: '#D4A574', shape: 'cushion', av: false },
  bolet_elegant: { n: 'Bolet élégant', tints: ['#E39A2A', '#EBAB43', '#D48A1D'], under: '#ECD03C', stem: '#E8CF6B', ring: '#F2E6B8', shape: 'cushion', av: false },
  bolet_rude: { n: 'Bolet rude', tints: ['#8C6A4C', '#9C7A5B', '#7C5C40'], under: '#E3DDD2', stem: '#EEEAE2', dots: '#2E2622', shape: 'dome', av: false },
  bolet_appendicule: { n: 'Bolet appendiculé', tints: ['#9A5A33', '#AA6A42', '#884C28'], under: '#E9C935', stem: '#E5C750', shape: 'dome', av: false },
  chanterelle_jaunissante: { n: 'Chanterelle jaunissante', tints: ['#9A6A42', '#AA7A52', '#8A5C36'], under: '#E9A673', stem: '#F0A93A', shape: 'funnel', av: false },
  hydne_roux: { n: 'Hydne roussissant', tints: ['#E39A5C', '#EAAB72', '#D68A4A'], under: '#F1C99B', stem: '#F1DDC4', shape: 'wavy', av: false },
  vesse_perlee: { n: 'Vesse-de-loup perlée', tints: ['#EFE9DC', '#E6DFCF', '#F5F1E8'], under: '#EFE9DC', stem: '#EFE9DC', shape: 'ball', tex: 'spots', spot: '#CFC4AE', av: false },
  truffe_noire: { n: 'Truffe noire', tints: ['#1E1A19', '#2A2523', '#171413'], under: '#1E1A19', stem: '#1E1A19', shape: 'ball', tex: 'spots', spot: '#3E3632', av: false },
  pholiote_peuplier: { n: 'Pholiote du peuplier', tints: ['#C9AA86', '#D6BA99', '#BA9874'], under: '#9C7B5A', stem: '#F1EADF', ring: '#EDE3D3', shape: 'convex', av: false },
  meunier: { n: 'Meunier', tints: ['#EEEBE6', '#E6E2DB', '#F5F3EF'], under: '#E9CFC4', stem: '#F1EEE9', shape: 'wavy', av: false },
  lactaire_saumon: { n: 'Lactaire couleur de saumon', tints: ['#EE9C6E', '#F2AC82', '#E28B5C'], under: '#F3B38A', stem: '#F0A780', shape: 'funnel', av: false },
  craterelle_sinueuse: { n: 'Craterelle sinueuse', tints: ['#6F665D', '#82786E', '#5E564E'], under: '#9E968C', stem: '#857B70', shape: 'horn', av: false },
  hydne_imbrique: { n: 'Hydne imbriqué', tints: ['#7A5A40', '#8A6A4E', '#6A4C34'], under: '#8E8276', stem: '#8E8276', shape: 'convex', tex: 'scales', scale: '#3E2A1C', av: false },
  amanite_jonquille: { n: 'Amanite jonquille', tints: ['#EAD27A', '#F0DC90', '#E0C766'], under: '#FAF8EF', stem: '#F7F4EA', volva: true, shape: 'convex', tex: 'spots', spot: '#FBF8EE', av: false },
  amanite_epaisse: { n: 'Amanite épaisse', tints: ['#8A8077', '#9A9087', '#7A7068'], under: '#F6F3EE', stem: '#EFEBE5', ring: '#F3F0EA', shape: 'convex', tex: 'spots', spot: '#BDB6AC', av: false },
  amanite_vaginee: { n: 'Amanite vaginée', tints: ['#8E8E8C', '#A09F9C', '#7D7D7B'], under: '#F7F6F3', stem: '#ECEBE7', volva: true, shape: 'convex', av: false },
  bolet_legal: { n: 'Bolet de Le Gal', tints: ['#D9A39A', '#E2B3AB', '#CC9289'], under: '#C83A22', stem: '#D96A48', dots: '#A92A18', shape: 'dome', av: false },
  bolet_pourpre: { n: 'Bolet rhodoxanthe', tints: ['#E3CFC6', '#EBDBD4', '#D9C0B5'], under: '#C2281C', stem: '#D8492E', dots: '#9E1E14', shape: 'dome', av: false },
  bolet_beau_pied: { n: 'Bolet à beau pied', tints: ['#B5AA94', '#C3B9A5', '#A69A83'], under: '#E5C63B', stem: '#C83A3A', shape: 'dome', av: false },
  bolet_radicant: { n: 'Bolet radicant', tints: ['#DCD6C9', '#E6E1D6', '#D0C9BA'], under: '#E9D23E', stem: '#E3CB5A', shape: 'dome', av: false },
  tricholome_tigre: { n: 'Tricholome tigré', tints: ['#8E8E8E', '#A0A0A0', '#7C7C7C'], under: '#EFEDE8', stem: '#F1EFEA', shape: 'convex', tex: 'scales', scale: '#4A4A4A', av: false },
  tricholome_soufre: { n: 'Tricholome soufré', tints: ['#D9C03C', '#E3CC55', '#C9AF30'], under: '#E6CD3A', stem: '#E3CB48', shape: 'convex', av: false },
  tricholome_savonneux: { n: 'Tricholome savonneux', tints: ['#8C8A6E', '#9C9A80', '#7C7A5F'], under: '#E8E6D6', stem: '#EFEDE5', shape: 'convex', av: false },
  hebelome: { n: 'Hébélome échaudé', tints: ['#D9C29C', '#E2CFAE', '#CCB28A'], under: '#B89A74', stem: '#EFE7DA', shape: 'convex', av: false },
  lepiote_cretee: { n: 'Lépiote crêtée', tints: ['#F2EDE7', '#EAE3DB', '#F7F4F0'], under: '#F7F4EF', stem: '#EFE6DE', shape: 'parasol', scale: '#9A5A3C', stemH: 0.65, av: false },
  pholiotine: { n: 'Pholiotine ridée', tints: ['#B97A3C', '#C78B4C', '#A86C30'], under: '#B0773E', stem: '#D9C3A2', ring: '#C9A57C', shape: 'conic', av: false },
  gymnopile: { n: 'Pholiote remarquable', tints: ['#D88A2A', '#E29C40', '#C77A1F'], under: '#C88A2E', stem: '#E2B055', ring: '#C08035', shape: 'convex', av: false },
  clavaire_elegante: { n: 'Clavaire élégante', tints: ['#EE9A7A', '#F2AC90', '#E28866'], under: '#EE9A7A', stem: '#F3E9DC', shape: 'star', av: false },
  russule_fetide: { n: 'Russule fétide', tints: ['#B8904E', '#C6A062', '#A8803E'], under: '#EFE6CF', stem: '#ECE5D6', shape: 'convex', av: false },
  lactaire_poivre: { n: 'Lactaire poivré', tints: ['#F3F1EA', '#EBE8DE', '#F8F7F2'], under: '#F1EBD6', stem: '#F4F2EB', shape: 'funnel', av: false },
  lactaire_plombe: { n: 'Lactaire plombé', tints: ['#3E3A22', '#4C4730', '#302D19'], under: '#E9E1C6', stem: '#5B5A3A', shape: 'funnel', av: false },
  coprin_noir: { n: 'Coprin noir d\'encre', tints: ['#A39A90', '#B3AAA0', '#938A80'], under: '#3A3532', stem: '#F1EEE8', shape: 'bell', av: false },
  clathre_rouge: { n: 'Clathre rouge', tints: ['#E2382C', '#EA4E40', '#CF2A20'], under: '#E2382C', stem: '#F1ECE3', shape: 'ball', tex: 'spots', spot: '#4E5A2A', av: false },
  helvelle_crepue: { n: 'Helvelle crépue', tints: ['#EEE7D8', '#E6DDCB', '#F4EFE4'], under: '#EEE7D8', stem: '#F1ECE2', shape: 'brain', stemH: 1.3, av: false },
  verpe_boheme: { n: 'Verpe de Bohême', tints: ['#8E6A44', '#9E7A52', '#7E5C38'], under: '#8E6A44', stem: '#F1E8D6', shape: 'bell', stemH: 1.3, av: false },
  ganoderme: { n: 'Ganoderme aplani', tints: ['#6A4C36', '#7A5A42', '#5A3E2A'], under: '#F2EEE6', stem: '#6A5643', shape: 'shelf', shelves: 1, thick: 1.6, av: false },
  polypore_bouleau: { n: 'Polypore du bouleau', tints: ['#D9CFC0', '#E3DBCE', '#CCC0AE'], under: '#F6F3EC', stem: '#8A7B66', shape: 'shelf', shelves: 1, thick: 1.4, av: false },
  tremelle: { n: 'Trémelle mésentérique', tints: ['#F2B21E', '#F6C23A', '#E6A012'], under: '#F2B21E', stem: '#7A6B5C', shape: 'brain', stemH: 0.25, av: false },
  xylaire: { n: 'Xylaire du bois', tints: ['#2A2624', '#3A3532', '#1E1B19'], under: '#F1EFEA', stem: '#2A2624', shape: 'horn', av: false },
  inocybe_fastigie: { n: 'Inocybe fastigié', tints: ['#C9A66A', '#D4B67F', '#BB9558'], under: '#9E8A64', stem: '#EFE6D6', shape: 'conic', av: false },
  pholiote_ecailleuse: { n: 'Pholiote écailleuse', tints: ['#D7B45E', '#E0C274', '#C9A44C'], under: '#B38A4A', stem: '#D9BE7A', ring: '#C9A46A', shape: 'convex', tex: 'scales', scale: '#8A4E22', av: false },
  inconnu: { n: 'Mystère', tints: ['#9AA39C', '#B5BCB6', '#7E8781'], under: '#D9DDD9', stem: '#E7EAE7', shape: 'dome', av: false }
};
// chapeaux proposés pour les avatars
export const AVATAR_CAPS = Object.keys(CAPS).filter(k => CAPS[k].av !== false);
export const EYES = { rond: 'Ronds', joyeux: 'Joyeux', clin: 'Clin d\'œil' };
export const MOUTHS = { sourire: 'Sourire', rire: 'Rire', o: 'Étonné', moustache: 'Moustache' };
export const ACCS = { aucun: 'Rien', panier: 'Panier', loupe: 'Loupe', baton: 'Bâton', couteau: 'Couteau' };
export const HEADS = { aucun: 'Rien', feuille: 'Feuille de chêne', escargot: 'Escargot', lampe: 'Lampe frontale' };
export const SCARVES = [null, '#C0392B', '#2E6FD1', '#2C8C4B', '#E0A21B', '#7D3C98', '#1D1D1D'];

export function randomAvatar() {
  const pick = o => { const k = Array.isArray(o) ? o : Object.keys(o); return k[Math.floor(Math.random() * k.length)]; };
  return { v: 1, cap: pick(AVATAR_CAPS), tint: Math.floor(Math.random() * 3), eyes: pick(['rond', 'rond', 'joyeux', 'clin']), mouth: pick(['sourire', 'sourire', 'rire', 'o', 'moustache']),
    cheeks: Math.random() < 0.7, acc: pick(ACCS), head: pick(['aucun', 'aucun', 'feuille', 'escargot', 'lampe']), scarf: pick(SCARVES), glasses: Math.random() < 0.25 };
}
export function normalizeAvatar(a) {
  const d = { v: 1, cap: 'cepe', tint: 0, eyes: 'rond', mouth: 'sourire', cheeks: true, acc: 'panier', head: 'aucun', scarf: '#C0392B', glasses: false };
  const o = Object.assign({}, d, a || {});
  if (!CAPS[o.cap]) o.cap = 'cepe';
  o.tint = Math.max(0, Math.min(2, o.tint | 0));
  if (!EYES[o.eyes]) o.eyes = 'rond';
  if (!MOUTHS[o.mouth]) o.mouth = 'sourire';
  if (!ACCS[o.acc]) o.acc = 'aucun';
  if (!HEADS[o.head]) o.head = 'aucun';
  if (o.scarf && !/^#[0-9a-f]{6}$/i.test(o.scarf)) o.scarf = null;
  o.cheeks = !!o.cheeks; o.glasses = !!o.glasses;
  return o;
}
export const avatarKey = a => JSON.stringify(normalizeAvatar(a));

// ---------- matériaux « dessin animé » ----------
let gradientMap = null;
function toonGradient() {
  if (gradientMap) return gradientMap;
  const data = new Uint8Array([95, 175, 255]);
  gradientMap = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.generateMipmaps = false;
  gradientMap.needsUpdate = true;
  return gradientMap;
}
const toon = (color, extra) => new THREE.MeshToonMaterial(Object.assign({ color: new THREE.Color(color), gradientMap: toonGradient() }, extra || {}));
const OUTLINE = new THREE.Color('#2A1E18');

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function morelTexture(base) {
  return canvasTexture(256, 256, (g, w, h) => {
    const c = new THREE.Color(base);
    g.fillStyle = '#' + c.clone().offsetHSL(0, -0.08, 0.16).getHexString(); g.fillRect(0, 0, w, h);
    const r = seeded(7), cols = 12, rows = 9;
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const x = (col + (row % 2) * 0.5 + (r() - 0.5) * 0.25) * (w / cols), y = (row + 0.5 + (r() - 0.5) * 0.2) * (h / rows);
      g.fillStyle = '#' + c.clone().offsetHSL(0, 0.04, -0.1 - r() * 0.06).getHexString();
      g.beginPath(); g.ellipse(x, y, w / cols * 0.36, h / rows * 0.4, (r() - 0.5) * 0.4, 0, Math.PI * 2); g.fill();
      if (x < w / cols) { g.beginPath(); g.ellipse(x + w, y, w / cols * 0.36, h / rows * 0.4, 0, 0, Math.PI * 2); g.fill(); }
    }
  });
}
function scalesTexture(base, scale) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const r = seeded(11);
    g.fillStyle = scale || '#8A6A45';
    g.fillRect(0, 0, w, 26);
    for (let ring = 0; ring < 6; ring++) {
      const y = 40 + ring * 34, n = 6 + ring * 3;
      for (let k = 0; k < n; k++) { const x = (k + r()) * (w / n); g.globalAlpha = 0.75 - ring * 0.08; g.beginPath(); g.ellipse(x, y + r() * 8, 7 - ring * 0.6, 4, r(), 0, Math.PI * 2); g.fill(); }
    }
    g.globalAlpha = 1;
  });
}
// taches, verrues ou plaques sur le chapeau (plus serrées vers le sommet, où la texture se resserre)
function spotsTexture(base, spot, seed) {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const r = seeded(seed || 5); g.fillStyle = spot;
    for (let row = 0; row < 7; row++) {
      const y = 22 + row * 34, n = 4 + row * 2, rad = 9 - row * 0.55;
      for (let k = 0; k < n; k++) {
        const x = (k + 0.5 + (r() - 0.5) * 0.6) * (w / n), yy = y + (r() - 0.5) * 12, rx = rad * (0.7 + r() * 0.6) * Math.max(1, 6 / n * 1.6);
        g.beginPath(); g.ellipse(x, yy, rx, rad * (0.6 + r() * 0.5), r() * 3, 0, Math.PI * 2); g.fill();
        if (x - rx < 0) { g.beginPath(); g.ellipse(x + w, yy, rx, rad * 0.8, 0, 0, Math.PI * 2); g.fill(); }
      }
    }
  });
}
// replis tortueux (gyromitre)
function foldsTexture(base) {
  return canvasTexture(256, 256, (g, w, h) => {
    const c = new THREE.Color(base);
    g.fillStyle = '#' + c.clone().offsetHSL(0, 0, 0.08).getHexString(); g.fillRect(0, 0, w, h);
    const r = seeded(13); g.strokeStyle = '#' + c.clone().offsetHSL(0, 0, -0.14).getHexString(); g.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      let x = r() * w, y = r() * h, a = r() * 6.3; g.lineWidth = 3 + r() * 3; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 7; k++) { a += (r() - 0.5) * 1.8; x += Math.cos(a) * 12; y += Math.sin(a) * 12; g.lineTo(x, y); }
      g.stroke();
    }
  });
}
// ponctuations ou écailles sur le pied
function dotsTexture(base, dot) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const r = seeded(9); g.fillStyle = dot;
    for (let i = 0; i < 260; i++) { const x = r() * w, y = 10 + r() * (h - 26); g.beginPath(); g.ellipse(x, y, 1.6 + r() * 1.6, 1.2 + r(), 0, 0, Math.PI * 2); g.fill(); }
  });
}
function wickerTexture() {
  return canvasTexture(128, 64, (g, w, h) => {
    g.fillStyle = '#A8743E'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#7A4F25'; g.lineWidth = 3;
    for (let y = 6; y < h; y += 10) { g.beginPath(); for (let x = 0; x <= w; x += 4) g.lineTo(x, y + Math.sin(x / 6) * 2.2); g.stroke(); }
    g.strokeStyle = '#C9965A'; g.lineWidth = 2;
    for (let x = 0; x < w; x += 12) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  });
}
function blobTexture() {
  return canvasTexture(128, 128, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 2, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(20,28,22,0.45)'); grd.addColorStop(1, 'rgba(20,28,22,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, w);
  });
}

// ---------- géométries ----------
const V = (x, y) => new THREE.Vector2(x, y);
function lathe(points, seg) { const g = new THREE.LatheGeometry(points, seg || 40); g.computeVertexNormals(); return g; }

// Profils de chapeau (rayon, hauteur) du sommet vers le dessous ; y=0 au raccord avec le pied
function capProfile(shape) {
  const P = [];
  const quarter = (R, H, base, n, pow) => { for (let i = 0; i <= n; i++) { const a = i / n * Math.PI / 2; P.push(V(R * Math.pow(Math.sin(a), pow || 1), base + H * Math.cos(a))); } };
  switch (shape) {
    case 'dome': quarter(0.66, 0.46, 0.12, 18, 0.85); P.push(V(0.63, 0.06), V(0.55, 0.03), V(0.28, 0.02), V(0.2, 0.04)); break;
    case 'cushion': quarter(0.64, 0.34, 0.12, 18, 0.7); P.push(V(0.62, 0.07), V(0.52, 0.04), V(0.26, 0.03), V(0.2, 0.05)); break;
    case 'convex': quarter(0.62, 0.3, 0.14, 18, 0.8); P.push(V(0.6, 0.1), V(0.56, 0.07), V(0.5, 0.06), V(0.24, 0.04), V(0.18, 0.06)); break;
    case 'hemi': quarter(0.6, 0.5, 0.1, 20, 1); P.push(V(0.57, 0.06), V(0.3, 0.03), V(0.2, 0.05)); break;
    case 'parasol': P.push(V(0, 0.3), V(0.08, 0.29), V(0.14, 0.24), V(0.38, 0.2), V(0.64, 0.13), V(0.71, 0.09), V(0.69, 0.06), V(0.36, 0.1), V(0.12, 0.12), V(0.1, 0.1)); break;
    case 'funnel': P.push(V(0, 0.22), V(0.18, 0.25), V(0.38, 0.33), V(0.54, 0.42), V(0.6, 0.44), V(0.58, 0.38), V(0.42, 0.24), V(0.26, 0.08), V(0.18, -0.04)); break;
    case 'horn': P.push(V(0.06, 0.18), V(0.22, 0.32), V(0.38, 0.55), V(0.48, 0.72), V(0.52, 0.74), V(0.5, 0.66), V(0.34, 0.42), V(0.2, 0.16), V(0.16, -0.02)); break;
    case 'cone': P.push(V(0, 0.98)); for (let i = 1; i <= 16; i++) { const t = i / 16; P.push(V(0.36 * Math.sin(t * Math.PI * 0.62) * (1 - 0.15 * t), 0.98 - t * 0.86)); } P.push(V(0.3, 0.1), V(0.24, 0.06)); break;
    case 'wavy': quarter(0.62, 0.24, 0.12, 18, 0.65); P.push(V(0.6, 0.08), V(0.5, 0.05), V(0.25, 0.04), V(0.19, 0.06)); break;
    case 'bell': quarter(0.33, 0.24, 0.66, 12, 0.9); P.push(V(0.34, 0.5), V(0.34, 0.3), V(0.33, 0.12), V(0.3, 0.02), V(0.24, 0.0), V(0.17, 0.03)); break;
    case 'conic': P.push(V(0, 0.5), V(0.06, 0.5), V(0.12, 0.45), V(0.24, 0.33), V(0.4, 0.2), V(0.52, 0.11), V(0.56, 0.06), V(0.52, 0.04), V(0.24, 0.03), V(0.17, 0.05)); break;
    case 'brain': quarter(0.58, 0.48, 0.1, 18, 0.75); P.push(V(0.55, 0.05), V(0.4, 0.02), V(0.2, 0.03)); break;
    case 'ball': for (let i = 0; i <= 22; i++) { const a = i / 22 * Math.PI; P.push(V(0.5 * Math.sin(a) * (1 + 0.05 * Math.sin(a * 2)), 0.37 + 0.44 * Math.cos(a))); } break;
  }
  return P.reverse();
}
function capTop(shape) { return Math.max(...capProfile(shape).map(p => p.y)); }
function capRadiusAt(shape, y) { const P = capProfile(shape); let best = 0; for (const p of P) if (p.y >= y - 0.06) best = Math.max(best, p.x); return best; }
function waveRim(geo, rMin, amp, k) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
    if (r > rMin) p.setY(i, p.getY(i) + amp * Math.sin(k * Math.atan2(z, x)) * (r - rMin) / (1 - rMin));
  }
  geo.computeVertexNormals();
}
// Pied : rayon en fonction de la hauteur (0 = sol, h = raccord)
function stemSpec(shape) {
  if (shape === 'ball' || shape === 'star') return { h: 0.08, r0: 0.12, r1: 0.12, bulb: 0 };
  if (shape === 'bell') return { h: 0.5, r0: 0.17, r1: 0.14, bulb: 0.03 };
  if (shape === 'conic') return { h: 0.6, r0: 0.13, r1: 0.11, bulb: 0.02 };
  if (shape === 'parasol') return { h: 0.86, r0: 0.16, r1: 0.1, bulb: 0.05 };
  if (shape === 'funnel') return { h: 0.46, r0: 0.17, r1: 0.19, bulb: 0 };
  if (shape === 'horn') return { h: 0.34, r0: 0.17, r1: 0.16, bulb: 0 };
  if (shape === 'cone') return { h: 0.46, r0: 0.25, r1: 0.22, bulb: 0.02 };
  if (shape === 'hemi') return { h: 0.6, r0: 0.18, r1: 0.16, bulb: 0.02 };
  if (shape === 'dome' || shape === 'cushion') return { h: 0.56, r0: 0.3, r1: 0.22, bulb: 0.06 };
  return { h: 0.54, r0: 0.24, r1: 0.19, bulb: 0.03 };
}
const stemR = (s, y) => { const t = Math.max(0, Math.min(1, y / s.h)); return s.r0 + (s.r1 - s.r0) * t + s.bulb * Math.sin(Math.PI * Math.min(1, t * 1.4)) * (1 - t); };
function stemGeometry(s) {
  const P = [V(0, 0)];
  for (let i = 0; i <= 14; i++) { const y = s.h * i / 14; P.push(V(stemR(s, y) * (i === 0 ? 0.92 : 1), y)); }
  P.push(V(0, s.h));
  return lathe(P, 32);
}

function withOutline(mesh, thick) {
  const o = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide }));
  o.scale.setScalar(1 + (thick || 0.035));
  o.userData.outline = true;
  mesh.add(o);
  return mesh;
}

// ---------- construction du personnage ----------
export function buildMushroom(cfg, opts) {
  const a = normalizeAvatar(cfg);
  const o = Object.assign({ face: true, arms: true, extras: true }, opts || {});
  const C = CAPS[a.cap];
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const s = Object.assign({}, stemSpec(C.shape)); if (C.stemH) s.h *= C.stemH;
  const parts = { root, body, eyes: [], arms: [], blink: 0 };
  const shadow = () => {
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.002; root.add(blob);
  };
  // consoles sur un tronc (polypores, langue de bœuf, oreille de Judas) et anthurus en étoile : pas de pied ni de visage
  if (C.shape === 'shelf' || C.shape === 'star') {
    (C.shape === 'shelf' ? buildShelf : buildStar)(C, C.tints[a.tint] || C.tints[0], body);
    parts.cap = body; shadow();
    parts.height = C.shape === 'shelf' ? 1.1 : 0.36;
    return parts;
  }

  // pied
  const stem = withOutline(new THREE.Mesh(stemGeometry(s), C.dots ? toon('#FFFFFF', { map: dotsTexture(C.stem, C.dots) }) : toon(C.stem)), 0.04);
  body.add(stem);
  if (C.volva) { // volve blanche
    const volva = withOutline(new THREE.Mesh(lathe([V(0.2, 0), V(0.25, 0.02), V(0.27, 0.12), V(0.24, 0.17), V(0.21, 0.13), V(0.2, 0.05)], 28), toon('#F4F1EA')), 0.03);
    volva.scale.setScalar(Math.max(0.75, (s.r0 + 0.05) / 0.23)); body.add(volva);
  }
  if (C.ring) { // anneau en jupe
    const y = s.h * (C.shape === 'bell' ? 0.55 : 0.8), r1 = stemR(s, y) + 0.008, r2 = stemR(s, y - 0.07) + 0.055;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, 0.075, 28, 1, true), toon(C.ring, { side: THREE.DoubleSide }));
    ring.position.y = y - 0.035; body.add(ring);
  }
  if (C.shape === 'parasol') { // anneau double coulissant
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 10, 28), toon('#F3ECDD'));
    ring.rotation.x = Math.PI / 2; ring.position.y = s.h * 0.72; body.add(ring);
    const snake = new THREE.Mesh(new THREE.CylinderGeometry(stemR(s, s.h * 0.3) + 0.004, stemR(s, s.h * 0.1) + 0.004, s.h * 0.35, 24, 1, true), toon('#B79C76', { transparent: true, opacity: 0.55 }));
    snake.position.y = s.h * 0.22; body.add(snake);
  }

  // chapeau
  const capGroup = new THREE.Group(); capGroup.position.y = s.h - 0.02; body.add(capGroup);
  const capGeo = lathe(capProfile(C.shape), 48);
  if (C.shape === 'funnel') waveRim(capGeo, 0.42, 0.045, 7);
  if (C.shape === 'wavy') waveRim(capGeo, 0.4, 0.035, 5);
  if (C.shape === 'horn') waveRim(capGeo, 0.42, 0.05, 6);
  if (C.shape === 'brain') waveRim(capGeo, 0.05, 0.07, 5);
  let capMat;
  const tint = C.tints[a.tint] || C.tints[0];
  if (C.shape === 'cone') capMat = toon('#FFFFFF', { map: morelTexture(tint) });
  else if (C.shape === 'brain') capMat = toon('#FFFFFF', { map: foldsTexture(tint) });
  else if (C.shape === 'parasol' || C.tex === 'scales') capMat = toon('#FFFFFF', { map: scalesTexture(tint, C.scale) });
  else if (C.tex === 'spots') capMat = toon('#FFFFFF', { map: spotsTexture(tint, C.spot, a.cap.length) });
  else capMat = toon(tint);
  if (C.shape === 'horn') capMat.side = THREE.DoubleSide;
  const cap = withOutline(new THREE.Mesh(capGeo, capMat), 0.03);
  capGroup.add(cap);
  if (!['horn', 'cone', 'funnel', 'bell', 'ball', 'brain'].includes(C.shape)) { // dessous : pores / lames
    const under = new THREE.Mesh(new THREE.CircleGeometry(0.5 * (C.shape === 'parasol' ? 1.3 : 1.05), 40), toon(C.under, { side: THREE.DoubleSide }));
    under.rotation.x = Math.PI / 2; under.position.y = C.shape === 'parasol' ? 0.075 : 0.045; capGroup.add(under);
  }
  if (C.shape === 'hemi' || C.shape === 'dome') { // reflet
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.55 }));
    shine.scale.set(1.6, 0.6, 1); shine.position.set(-0.22, C.shape === 'hemi' ? 0.52 : 0.5, 0.25); capGroup.add(shine);
  }
  parts.cap = capGroup;

  // visage sur le pied
  const faceY = Math.min(s.h * 0.62, s.h - 0.12);
  const fr = stemR(s, faceY);
  if (o.face) {
    const face = new THREE.Group(); face.position.set(0, faceY, 0); body.add(face);
    const black = new THREE.MeshBasicMaterial({ color: '#1B1412' }), white = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
    const ex = Math.min(0.085, fr * 0.42), ez = fr * Math.cos(Math.asin(Math.min(0.95, ex / fr))) + 0.012;
    const mkEye = (x, closed) => {
      const g = new THREE.Group(); g.position.set(x, 0.035, ez - 0.01);
      if (closed) { const arc = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 6, 14, Math.PI), black); arc.position.y = -0.008; g.add(arc); }
      else {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.034, 16, 12), black); e.scale.set(1, 1.22, 0.55); g.add(e);
        const h = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), white); h.position.set(-0.01, 0.014, 0.018); g.add(h);
        parts.eyes.push(g);
      }
      face.add(g); return g;
    };
    if (a.eyes === 'joyeux') { mkEye(-ex, true); mkEye(ex, true); }
    else if (a.eyes === 'clin') { mkEye(-ex, false); mkEye(ex, true); }
    else { mkEye(-ex, false); mkEye(ex, false); }
    const mz = stemR(s, faceY - 0.035) + 0.01;
    if (a.mouth === 'rire') {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.042, 20, Math.PI, Math.PI), new THREE.MeshBasicMaterial({ color: '#7A1F2B', side: THREE.DoubleSide })); m.position.set(0, -0.035, mz + 0.004); face.add(m);
    } else if (a.mouth === 'o') {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.008, 8, 18), black); m.position.set(0, -0.045, mz); face.add(m);
    } else if (a.mouth === 'moustache') {
      const mm = toon('#5A3A22');
      [-1, 1].forEach(sx => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), mm); m.scale.set(1.5, 0.6, 0.6); m.position.set(sx * 0.038, -0.03, mz + 0.004); m.rotation.z = -sx * 0.25; face.add(m); });
      const sm = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 12, Math.PI), black); sm.rotation.z = Math.PI; sm.position.set(0, -0.058, mz); face.add(sm);
    } else {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.009, 6, 16, Math.PI), black); m.rotation.z = Math.PI; m.position.set(0, -0.026, mz); face.add(m);
    }
    if (a.cheeks) {
      const pink = new THREE.MeshBasicMaterial({ color: '#F08FA0', transparent: true, opacity: 0.75 });
      [-1, 1].forEach(sx => { const c = new THREE.Mesh(new THREE.CircleGeometry(0.024, 16), pink); const x = sx * (ex + 0.05), cr = stemR(s, faceY - 0.022); c.position.set(x, -0.022, Math.sqrt(Math.max(0, cr * cr - x * x)) + 0.006); c.rotation.y = Math.asin(Math.max(-0.9, Math.min(0.9, x / fr))); face.add(c); });
    }
    if (a.glasses) {
      const gm = new THREE.MeshBasicMaterial({ color: '#2B2B2B' });
      [-1, 1].forEach(sx => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.007, 8, 24), gm); r.position.set(sx * ex, 0.035, ez + 0.012); face.add(r); });
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, ex * 2 - 0.08, 6), gm); b.rotation.z = Math.PI / 2; b.position.set(0, 0.045, ez + 0.012); face.add(b);
    }
    parts.face = face;
  }

  // écharpe
  if (o.extras && a.scarf) {
    const sy = Math.max(faceY + 0.1, s.h - 0.12);
    const sc = new THREE.Mesh(new THREE.TorusGeometry(stemR(s, sy) + 0.015, 0.035, 10, 32), toon(a.scarf));
    sc.rotation.x = Math.PI / 2; sc.position.y = sy; body.add(sc);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.03), toon(a.scarf));
    tail.position.set(stemR(s, sy) * 0.55, sy - 0.08, stemR(s, sy) * 0.8); tail.rotation.z = 0.25; body.add(tail);
  }

  // bras + accessoire
  if (o.arms) {
    const armMat = toon(C.stem);
    const ay = Math.max(0.12, faceY - 0.14), ar = stemR(s, ay);
    [-1, 1].forEach(sx => {
      const pivot = new THREE.Group(); pivot.position.set(sx * (ar - 0.01), ay, 0.02); body.add(pivot);
      const arm = withOutline(new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.12, 4, 10), armMat), 0.06);
      arm.position.set(sx * 0.06, -0.05, 0); arm.rotation.z = sx * 0.9; pivot.add(arm);
      const hand = new THREE.Group(); hand.position.set(sx * 0.12, -0.1, 0.02); pivot.add(hand);
      pivot.userData.sx = sx; parts.arms.push(pivot);
      if (sx === 1 && o.extras) addAccessory(a.acc, hand);
    });
  }
  // décor sur le chapeau
  if (o.extras && a.head !== 'aucun') addHead(a.head, capGroup, C.shape);

  // ombre au sol
  shadow();
  parts.height = s.h + (({ cone: 1.0, horn: 0.78, bell: 0.92, ball: 0.82, brain: 0.6 })[C.shape] || 0.5);
  return parts;
}
function barkTexture(base) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const r = seeded(3), dark = '#' + new THREE.Color(base).offsetHSL(0, 0, -0.07).getHexString();
    g.strokeStyle = dark; g.lineWidth = 2;
    for (let x = 4; x < w; x += 11) { g.beginPath(); for (let y = 0; y <= h; y += 8) g.lineTo(x + Math.sin(y / 9 + x) * 2.5 + (r() - 0.5) * 2, y); g.stroke(); }
  });
}
// consoles en demi-dôme accrochées à un tronc
function buildShelf(C, tint, body) {
  const tz = -0.34, tr = 0.3;
  const trunk = withOutline(new THREE.Mesh(new THREE.CylinderGeometry(tr, tr + 0.05, 1.12, 28), toon('#FFFFFF', { map: barkTexture(C.stem) })), 0.02);
  trunk.position.set(0, 0.56, tz); body.add(trunk);
  const th = C.thick || 1, n = C.shelves || 2;
  const list = n === 1 ? [[0.44, 0.5]] : n === 2 ? [[0.44, 0.36], [0.32, 0.72]] : [[0.46, 0.28], [0.38, 0.54], [0.28, 0.78]];
  for (const [r, y] of list) {
    const g = new THREE.Group(); g.position.set(0, y, tz + tr * 0.85); g.rotation.x = 0.32; body.add(g);
    const P = []; for (let i = 0; i <= 14; i++) { const t = i / 14 * Math.PI / 2; P.push(V(r * Math.sin(t), 0.2 * th * (r / 0.44) * Math.cos(t))); }
    const top = withOutline(new THREE.Mesh(new THREE.LatheGeometry(P.reverse(), 24, -Math.PI / 2, Math.PI), toon(tint, { side: THREE.DoubleSide })), 0.03);
    top.geometry.computeVertexNormals(); g.add(top);
    const under = new THREE.Mesh(new THREE.CircleGeometry(r, 24, 0, Math.PI), toon(C.under, { side: THREE.DoubleSide }));
    under.rotation.x = Math.PI / 2; under.position.y = 0.004; g.add(under);
  }
}
// anthurus : bras rouges en étoile sortant d'un œuf
function buildStar(C, tint, body) {
  const egg = withOutline(new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), toon(C.stem)), 0.03);
  egg.scale.set(1, 0.62, 1); egg.position.y = 0.1; body.add(egg);
  const mat = toon('#FFFFFF', { map: spotsTexture(tint, '#2A1A16', 3) }), up = new THREE.Vector3(0, 1, 0);
  for (let k = 0; k < 5; k++) {
    const ang = k / 5 * Math.PI * 2 + 0.35;
    const pts = [[0, 0.12], [0.12, 0.3], [0.3, 0.37], [0.5, 0.28], [0.62, 0.12]].map(([x, y]) => new THREE.Vector3(x, y, 0).applyAxisAngle(up, ang));
    body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.055, 10, false), mat));
  }
}

function addAccessory(kind, hand) {
  if (kind === 'panier') {
    const g = new THREE.Group(); g.position.set(0.06, -0.08, 0.04);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.12, 20, 1, true), toon('#FFFFFF', { map: wickerTexture(), side: THREE.DoubleSide }));
    g.add(withOutline(bowl, 0.05));
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), toon('#8A5A2C', { side: THREE.DoubleSide })); bottom.rotation.x = Math.PI / 2; bottom.position.y = -0.06; g.add(bottom);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.012, 8, 24, Math.PI), toon('#8A5A2C')); handle.position.y = 0.06; g.add(handle);
    const mini = new THREE.Group(); mini.position.set(0.02, 0.04, 0);
    mini.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.06, 10), toon('#EFE3C6')));
    const mc = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon('#7A4A2A')); mc.position.y = 0.025; mini.add(mc);
    g.add(mini);
    hand.add(g);
  } else if (kind === 'loupe') {
    const g = new THREE.Group(); g.position.set(0.02, 0.06, 0.05); g.rotation.z = -0.4;
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.013, 10, 28), toon('#D9A72B')));
    g.add(new THREE.Mesh(new THREE.CircleGeometry(0.066, 24), new THREE.MeshBasicMaterial({ color: '#BFE3F2', transparent: true, opacity: 0.4, side: THREE.DoubleSide })));
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.12, 10), toon('#6B3E1F')); h.position.y = -0.13; g.add(h);
    hand.add(g);
  } else if (kind === 'baton') {
    const st = withOutline(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.74, 10), toon('#7A5230')), 0.08);
    st.position.set(0.02, 0.06, 0.03); hand.add(st);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), toon('#5E3D22')); knot.position.set(0.02, 0.44, 0.03); hand.add(knot);
  } else if (kind === 'couteau') {
    const g = new THREE.Group(); g.position.set(0.02, 0.0, 0.05); g.rotation.z = -0.6;
    g.add(withOutline(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.11, 10), toon('#8B5A2B')), 0.08));
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.008), toon('#C9CED6')); blade.position.y = 0.1; g.add(blade);
    const brush = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.04, 10), toon('#3A2A1E')); brush.position.y = -0.07; g.add(brush);
    hand.add(g);
  }
}
function addHead(kind, capGroup, shape) {
  const top = capTop(shape);
  if (kind === 'feuille') {
    const leaf = new THREE.Shape();
    leaf.moveTo(0, 0); leaf.bezierCurveTo(0.06, 0.03, 0.08, 0.1, 0.0, 0.2); leaf.bezierCurveTo(-0.08, 0.1, -0.06, 0.03, 0, 0);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(leaf, 8), toon('#6E9F2E', { side: THREE.DoubleSide }));
    const y = shape === 'cone' ? top - 0.3 : shape === 'horn' ? top - 0.02 : top - 0.05;
    const r = shape === 'horn' ? capRadiusAt(shape, y) * 0.9 : Math.max(0.08, capRadiusAt(shape, y) * 0.55);
    m.position.set(r * 0.5, y, r * 0.75); m.rotation.set(-1.1, 0.2, -0.5); m.scale.setScalar(1.25); capGroup.add(m);
  } else if (kind === 'escargot') {
    const y = shape === 'cone' ? top * 0.45 : shape === 'horn' ? top * 0.6 : top - (shape === 'parasol' ? 0.12 : 0.16);
    const r = capRadiusAt(shape, y);
    const g = new THREE.Group(); g.position.set(r * 0.45, y + 0.02, r * 0.82); g.rotation.set(-0.35, 0.5, 0.15);
    const shell = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.022, 10, 20), toon('#C58B4A')); shell.position.y = 0.05; g.add(shell);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), toon('#A86E35')); inner.position.y = 0.05; g.add(inner);
    const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.08, 4, 8), toon('#D9C8A8')); foot.rotation.z = Math.PI / 2; foot.position.set(0.02, 0.012, 0); g.add(foot);
    [-1, 1].forEach(z => { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 5), toon('#D9C8A8')); t.position.set(0.07, 0.035, z * 0.008); t.rotation.z = -0.4; g.add(t); });
    capGroup.add(g);
  } else if (kind === 'lampe') {
    const y = shape === 'cone' ? 0.35 : shape === 'horn' ? 0.3 : shape === 'funnel' ? 0.3 : Math.max(0.14, top * 0.55);
    const r = capRadiusAt(shape, y) * (shape === 'horn' || shape === 'funnel' ? 0.85 : 0.97);
    const g = new THREE.Group(); g.position.set(0, y, r + 0.02);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 16), toon('#2B2F36')); body.rotation.x = Math.PI / 2; g.add(body);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.036, 16), new THREE.MeshBasicMaterial({ color: '#FFF3A3' })); lens.position.z = 0.027; g.add(lens);
    capGroup.add(g);
  }
}
function dispose(obj) {
  obj.traverse(n => {
    if (n.geometry && !n.userData.outline) n.geometry.dispose();
    if (n.material) { const ms = Array.isArray(n.material) ? n.material : [n.material]; ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); }
  });
}
function lights(scene) {
  scene.add(new THREE.HemisphereLight('#FFFFFF', '#5A6B4A', 1.1));
  const d = new THREE.DirectionalLight('#FFFFFF', 1.6); d.position.set(1.4, 2.2, 2.0); scene.add(d);
}
export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
}

// ---------- scène animée (éditeur, profil) ----------
export class AvatarStage {
  constructor(canvas, cfg, opts) {
    this.canvas = canvas; this.opts = Object.assign({ base: true, turn: true }, opts || {});
    this.ok = webglAvailable();
    if (!this.ok) { this._fallback(cfg); return; }
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene(); lights(this.scene);
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    if (this.opts.base) {
      const moss = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.08, 40), toon('#5E8C3A'));
      moss.position.y = -0.04; this.scene.add(withOutline(moss, 0.02));
      const r = seeded(3);
      for (let i = 0; i < 26; i++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.09 + r() * 0.06, 4), toon(r() < 0.5 ? '#6FA244' : '#4E7D2C'));
        const ang = r() * Math.PI * 2, rad = 0.38 + r() * 0.22; blade.position.set(Math.cos(ang) * rad, 0.03, Math.sin(ang) * rad); this.scene.add(blade);
      }
      const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.07, 10), toon('#B5651D', { side: THREE.DoubleSide })); leaf.rotation.x = -Math.PI / 2; leaf.position.set(-0.32, 0.005, 0.2); leaf.scale.set(1.5, 0.8, 1); this.scene.add(leaf);
    }
    this.t0 = performance.now(); this.anim = null; this.nextBlink = 1.5;
    this.setConfig(cfg);
    this._resize(); this._loop = this._loop.bind(this); this.raf = requestAnimationFrame(this._loop);
    this._onTap = () => this.play('hop'); canvas.addEventListener('pointerdown', this._onTap);
    if (window.ResizeObserver) { this.ro = new ResizeObserver(() => this._resize()); this.ro.observe(canvas); }
  }
  _fallback(cfg) { const img = new Image(); img.src = fallback2D(cfg, 256); img.onload = () => { const g = this.canvas.getContext('2d'); if (g) { this.canvas.width = 256; this.canvas.height = 256; g.drawImage(img, 0, 0); } }; }
  setConfig(cfg) {
    if (!this.ok) { this._fallback(cfg); return; }
    if (this.model) { this.scene.remove(this.model.root); dispose(this.model.root); }
    this.model = buildMushroom(cfg);
    this.scene.add(this.model.root);
    const h = this.model.height;
    this.camera.position.set(0, h * 0.62 + 0.15, 3.1 + h * 0.45);
    this.camera.lookAt(0, h * 0.45, 0);
  }
  play(name) { this.anim = { name, t: 0 }; }
  _resize() {
    const w = this.canvas.clientWidth || 240, h = this.canvas.clientHeight || 240;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  _loop(now) {
    if (this.dead) return;
    this.raf = requestAnimationFrame(this._loop);
    // 30 images/s suffisent, et rien à dessiner si la scène est cachée (économie de batterie)
    if (!this.canvas.isConnected || document.hidden || this.canvas.offsetParent === null) return;
    if (this._lastDraw && now - this._lastDraw < 30) return;
    this._lastDraw = now;
    const t = (now - this.t0) / 1000, m = this.model; if (!m) return;
    const dt = this._last ? Math.min(0.05, t - this._last) : 0.016; this._last = t;
    let y = 0.015 * Math.sin(t * 2.4), sq = 1 + 0.025 * Math.sin(t * 4.8), rot = this.opts.turn ? 0.45 * Math.sin(t * 0.7) : 0;
    if (this.anim) {
      const a = this.anim; a.t += dt; const d = a.name === 'cheer' ? 1.1 : 0.7, k = a.t / d;
      if (k >= 1) this.anim = null;
      else {
        const jump = Math.sin(Math.PI * Math.min(1, k * 1.25));
        y += 0.32 * Math.max(0, jump); sq *= k < 0.12 ? 1 - 1.4 * k : k > 0.86 ? 1 - (1 - k) * 0.9 : 1 + 0.12 * jump;
        if (a.name === 'cheer') rot += Math.PI * 2 * Math.min(1, k * 1.2);
        m.arms.forEach(p => { p.rotation.z = p.userData.sx * (-1.2 * jump); });
      }
    }
    if (!this.anim) m.arms.forEach((p, i) => { p.rotation.z = p.userData.sx * (0.12 * Math.sin(t * 2.4 + i)); });
    m.body.position.y = y; m.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)); m.root.rotation.y = rot;
    if (t > this.nextBlink) { m.blink = 0.14; this.nextBlink = t + 2.2 + Math.random() * 3; }
    if (m.blink > 0) { m.blink -= dt; const s = m.blink > 0.07 ? 0.15 : 1; m.eyes.forEach(e => { e.scale.y = s; }); if (m.blink <= 0) m.eyes.forEach(e => { e.scale.y = 1; }); }
    this.renderer.render(this.scene, this.camera);
  }
  destroy() {
    this.dead = true; cancelAnimationFrame(this.raf);
    if (this.ro) this.ro.disconnect();
    if (this.canvas && this._onTap) this.canvas.removeEventListener('pointerdown', this._onTap);
    if (this.model) dispose(this.model.root);
    if (this.renderer) { this.renderer.dispose(); this.renderer.forceContextLoss && this.renderer.forceContextLoss(); }
  }
}

// ---------- rendus fixes (marqueurs, listes, Mycodex) ----------
let snapR = null, snapScene = null, snapCam = null;
const snapCache = new Map();
function snapSetup() {
  if (snapR) return true;
  if (!webglAvailable()) return false;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  snapR = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
  snapR.setPixelRatio(1); snapR.setSize(256, 256, false);
  snapScene = new THREE.Scene(); lights(snapScene);
  snapCam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  return true;
}
export function snapshot(cfg, opts) {
  const o = Object.assign({ size: 160, face: true, arms: true, extras: true, angle: -0.35 }, opts || {});
  const key = JSON.stringify([normalizeAvatar(cfg), o]);
  if (snapCache.has(key)) return snapCache.get(key);
  let url;
  if (!snapSetup()) url = fallback2D(cfg, o.size);
  else {
    const m = buildMushroom(cfg, o);
    m.root.rotation.y = o.angle;
    snapScene.add(m.root);
    const h = m.height;
    snapCam.position.set(0, h * 0.58 + 0.1, 2.6 + h * 0.5); snapCam.lookAt(0, h * 0.46, 0);
    snapR.setSize(o.size, o.size, false);
    snapR.setClearColor(0x000000, 0);
    snapR.render(snapScene, snapCam);
    url = snapR.domElement.toDataURL('image/png');
    snapScene.remove(m.root); dispose(m.root);
  }
  snapCache.set(key, url);
  return url;
}
export function speciesIcon(capKey, size) {
  return snapshot({ cap: capKey, tint: 0, acc: 'aucun', head: 'aucun', scarf: null, glasses: false }, { size: size || 128, face: false, arms: false, extras: false, angle: 0.2 });
}

// Repli 2D (sans WebGL)
export function fallback2D(cfg, size) {
  const a = normalizeAvatar(cfg), C = CAPS[a.cap], s = size || 128;
  const c = document.createElement('canvas'); c.width = c.height = s;
  const g = c.getContext('2d'); if (!g) return '';
  g.scale(s / 100, s / 100);
  g.fillStyle = C.stem; g.strokeStyle = '#2A1E18'; g.lineWidth = 2.5;
  g.beginPath(); g.roundRect ? g.roundRect(36, 44, 28, 44, 10) : g.rect(36, 44, 28, 44); g.fill(); g.stroke();
  g.fillStyle = C.tints[a.tint] || C.tints[0];
  g.beginPath(); g.ellipse(50, 44, 38, 26, 0, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#1B1412'; g.beginPath(); g.arc(44, 62, 3, 0, 7); g.arc(56, 62, 3, 0, 7); g.fill();
  g.beginPath(); g.arc(50, 68, 5, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
  return c.toDataURL('image/png');
}
