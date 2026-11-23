export type ProfileAvatarCollection = 'Anime' | 'Movies' | 'TV Shows' | 'Superheroes';

export interface ProfileAvatar {
  id: string;
  name: string;
  collection: ProfileAvatarCollection;
  src: string;
  /** CSS focal point keeps faces readable inside the circular frame. */
  position?: string;
}

/** 60 local portraits. Existing IDs stay stable; artwork sources are in public/avatars/SOURCES.md. */
export const PROFILE_AVATARS: readonly ProfileAvatar[] = [
  // Anime
  { id: "pikachu", name: "Pikachu", collection: "Anime", src: "/avatars/pikachu.png" },
  { id: "naruto", name: "Naruto Uzumaki", collection: "Anime", src: "/avatars/naruto.webp" },
  { id: "sasuke", name: "Sasuke Uchiha", collection: "Anime", src: "/avatars/sasuke.webp" },
  { id: "kakashi", name: "Kakashi Hatake", collection: "Anime", src: "/avatars/kakashi.webp" },
  { id: "luffy-anime", name: "Luffy (Anime)", collection: "Anime", src: "/avatars/luffy-anime.webp" },
  { id: "zoro", name: "Roronoa Zoro", collection: "Anime", src: "/avatars/zoro.webp" },
  { id: "satoru-gojo", name: "Satoru Gojo", collection: "Anime", src: "/avatars/satoru-gojo.webp" },
  { id: "yuji-itadori", name: "Yuji Itadori", collection: "Anime", src: "/avatars/yuji-itadori.webp" },
  { id: "levi", name: "Levi Ackerman", collection: "Anime", src: "/avatars/levi.webp" },
  { id: "denji", name: "Denji", collection: "Anime", src: "/avatars/denji.webp" },
  { id: "power", name: "Power", collection: "Anime", src: "/avatars/power.webp" },
  { id: "ichigo", name: "Ichigo Kurosaki", collection: "Anime", src: "/avatars/ichigo.webp" },
  { id: "mikasa", name: "Mikasa Ackerman", collection: "Anime", src: "/avatars/mikasa.webp" },
  { id: "tanjiro", name: "Tanjiro Kamado", collection: "Anime", src: "/avatars/tanjiro.webp" },
  { id: "goku", name: "Goku", collection: "Anime", src: "/avatars/goku.webp" },
  // Movies
  { id: "kora", name: "Kora", collection: "Movies", src: "/avatars/kora.png" },
  { id: "jimmy", name: "Jimmy", collection: "Movies", src: "/avatars/jimmy.png" },
  { id: "the-creature", name: "The Creature", collection: "Movies", src: "/avatars/the-creature.png" },
  { id: "santa-claus", name: "Santa Claus", collection: "Movies", src: "/avatars/santa-claus.png" },
  { id: "nick-jakoby", name: "Nick Jakoby", collection: "Movies", src: "/avatars/nick-jakoby.png" },
  { id: "sonic", name: "Sonic", collection: "Movies", src: "/avatars/sonic.png" },
  { id: "rumi", name: "Rumi", collection: "Movies", src: "/avatars/rumi.png" },
  { id: "harry-potter", name: "Harry Potter", collection: "Movies", src: "/avatars/harry-potter.webp" },
  { id: "hermione-granger", name: "Hermione Granger", collection: "Movies", src: "/avatars/hermione-granger.webp" },
  { id: "neytiri", name: "Neytiri", collection: "Movies", src: "/avatars/neytiri.webp" },
  { id: "darth-vader", name: "Darth Vader", collection: "Movies", src: "/avatars/darth-vader.webp" },
  { id: "yoda", name: "Yoda", collection: "Movies", src: "/avatars/yoda.webp" },
  { id: "jack-sparrow", name: "Jack Sparrow", collection: "Movies", src: "/avatars/jack-sparrow.webp", position: "20% 50%" },
  { id: "indiana-jones", name: "Indiana Jones", collection: "Movies", src: "/avatars/indiana-jones.webp", position: "31% 50%" },
  { id: "john-wick", name: "John Wick", collection: "Movies", src: "/avatars/john-wick.webp", position: "45% 50%" },
  // TV Shows
  { id: "jinx", name: "Jinx", collection: "TV Shows", src: "/avatars/jinx.png" },
  { id: "vi", name: "Vi", collection: "TV Shows", src: "/avatars/vi.png" },
  { id: "wednesday", name: "Wednesday", collection: "TV Shows", src: "/avatars/wednesday.png" },
  { id: "eleven", name: "Eleven", collection: "TV Shows", src: "/avatars/eleven.png" },
  { id: "geralt", name: "Geralt", collection: "TV Shows", src: "/avatars/geralt.png" },
  { id: "luffy", name: "Luffy", collection: "TV Shows", src: "/avatars/luffy.png" },
  { id: "front-man", name: "Front Man", collection: "TV Shows", src: "/avatars/front-man.png" },
  { id: "tommy-shelby", name: "Tommy Shelby", collection: "TV Shows", src: "/avatars/tommy-shelby.webp", position: "50% 20%" },
  { id: "beth-harmon", name: "Beth Harmon", collection: "TV Shows", src: "/avatars/beth-harmon.webp", position: "50% 20%" },
  { id: "walter-white", name: "Walter White", collection: "TV Shows", src: "/avatars/walter-white.webp", position: "50% 20%" },
  { id: "joel-miller", name: "Joel Miller", collection: "TV Shows", src: "/avatars/joel-miller.webp" },
  { id: "daenerys", name: "Daenerys Targaryen", collection: "TV Shows", src: "/avatars/daenerys.webp", position: "50% 20%" },
  { id: "sabrina", name: "Sabrina Spellman", collection: "TV Shows", src: "/avatars/sabrina.webp", position: "50% 20%" },
  { id: "sherlock", name: "Sherlock Holmes", collection: "TV Shows", src: "/avatars/sherlock.webp", position: "50% 20%" },
  { id: "rick-grimes", name: "Rick Grimes", collection: "TV Shows", src: "/avatars/rick-grimes.webp", position: "50% 20%" },
  // Superheroes
  { id: "iron-man", name: "Iron Man", collection: "Superheroes", src: "/avatars/iron-man.webp", position: "44% 50%" },
  { id: "captain-america", name: "Captain America", collection: "Superheroes", src: "/avatars/captain-america.webp" },
  { id: "thor", name: "Thor", collection: "Superheroes", src: "/avatars/thor.webp", position: "58% 50%" },
  { id: "hulk", name: "Hulk", collection: "Superheroes", src: "/avatars/hulk.webp" },
  { id: "black-panther", name: "Black Panther", collection: "Superheroes", src: "/avatars/black-panther.webp" },
  { id: "doctor-strange", name: "Doctor Strange", collection: "Superheroes", src: "/avatars/doctor-strange.webp", position: "90% 50%" },
  { id: "captain-marvel", name: "Captain Marvel", collection: "Superheroes", src: "/avatars/captain-marvel.webp" },
  { id: "spider-man", name: "Spider-Man", collection: "Superheroes", src: "/avatars/spider-man.webp", position: "50% 20%" },
  { id: "black-widow", name: "Black Widow", collection: "Superheroes", src: "/avatars/black-widow.webp", position: "5% 50%" },
  { id: "shang-chi", name: "Shang-Chi", collection: "Superheroes", src: "/avatars/shang-chi.webp" },
  { id: "batman", name: "Batman", collection: "Superheroes", src: "/avatars/batman.webp", position: "45% 50%" },
  { id: "superman", name: "Superman", collection: "Superheroes", src: "/avatars/superman.webp", position: "40% 50%" },
  { id: "wonder-woman", name: "Wonder Woman", collection: "Superheroes", src: "/avatars/wonder-woman.webp", position: "45% 50%" },
  { id: "aquaman", name: "Aquaman", collection: "Superheroes", src: "/avatars/aquaman.webp", position: "70% 50%" },
  { id: "the-flash", name: "The Flash", collection: "Superheroes", src: "/avatars/the-flash.webp", position: "82% 50%" },
];

export const DEFAULT_PROFILE_AVATAR_ID = 'jinx';

const defaultAvatar = PROFILE_AVATARS.find((avatar) => avatar.id === DEFAULT_PROFILE_AVATAR_ID)!;

/** Older, missing, or unrecognized stored IDs always resolve to usable artwork. */
export function getProfileAvatar(id?: string | null): ProfileAvatar {
  return PROFILE_AVATARS.find((avatar) => avatar.id === id) ?? defaultAvatar;
}
