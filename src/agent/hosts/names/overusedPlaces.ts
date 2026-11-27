export const OVERUSED_PLACES: ReadonlySet<string> = new Set([
  'ashenvale',
  'blackwater',
  'brightwater',
  'duskwood',
  'eldergrove',
  'eldoria',
  'emberfall',
  'frosthold',
  'greywatch',
  'havenbrook',
  'ironhold',
  'mistvale',
  'moonhaven',
  'oakhaven',
  'oakheart',
  'ravenhold',
  'ravenwood',
  'riverbend',
  'shadowfen',
  'shadowvale',
  'silverbrook',
  'silvermoon',
  'starfall',
  'stonehaven',
  'stormhold',
  'stormwatch',
  'sunhaven',
  'thornwick',
  'thornwood',
  'whisperwood',
  'willowbrook',
  'willowdale',
]);

const FANTASY_PREFIX =
  'ash|black|bright|crystal|dawn|dusk|elder|ember|frost|ghost|gold|golden|grey|gray|iron|mist|moon|night|oak|raven|scale|shadow|silver|star|storm|sun|thorn|tide|veil|whisper|willow|wolf';
const FANTASY_SUFFIX =
  'brook|crest|dale|fall|falls|fell|fen|gate|glen|grove|guard|harbor|harbour|haven|heart|hold|hollow|holm|keep|mere|mire|moor|peak|reach|ridge|rock|shire|spine|spire|vale|watch|well|wood';
// Endings no real place list needs; an invented name with one is the AI style the tool exists to avoid.
const FANTASY_ENDING = /(haven|vale|spire|hold|reach|crest|keep|watch)$/;
const FANTASY_COMPOUND = new RegExp(`^(${FANTASY_PREFIX})(${FANTASY_SUFFIX})$`);

/** For invented names only: real places like Silverdale stay allowed. */
export function isFantasyCompound(name: string): boolean {
  return name
    .toLowerCase()
    .split(/[\s-]+/)
    .some((word) => FANTASY_ENDING.test(word) || FANTASY_COMPOUND.test(word));
}
