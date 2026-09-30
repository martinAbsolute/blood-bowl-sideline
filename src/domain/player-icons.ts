import iconData from "./data/player-icons.json";

export interface PlayerArtwork {
  label: string;
  group: string;
  width: number;
  height: number;
  variants: string[];
}
const icons: Record<string, PlayerArtwork> = iconData;

// Presentation only. IDs correspond to the existing rules catalog; source labels
// remain in the asset manifest. null means the source has no suitable artwork.
export const positionArtwork: Record<string, (string | null)[]> = {
  amazon: ["585645", "585646", "585647", "585648"],
  "black-orc": ["585650", "436319", "585653"],
  bretonnian: ["585640", "645253", "645274", "585587"],
  "chaos-chosen": ["585629", "436254", "436343", "436344", "436255"],
  "chaos-dwarf": ["585631", "585631", "436257", "436257", "436258", "436259"],
  "chaos-renegade": [
    "440149",
    "674140",
    "568459",
    "436380",
    "436379",
    "645274",
    "436343",
    "436344",
    "436345",
    "436326",
  ],
  "dark-elf": ["674159", "674152", "585634", "674158", "674157"],
  dwarf: ["436265", "436266", "436267", "436268", "436269"],
  "elven-union": ["585637", "440145", "440143", "440308"],
  gnome: [null, null, null, null, "436282"],
  goblin: [
    "585617",
    "436436",
    "436275",
    "568462",
    "578021",
    "436278",
    "436377",
    "436280",
  ],
  halfling: ["436281", "588601", "588599", "436282"],
  "high-elf": ["585638", "436284", "436286", "585639"],
  human: ["585640", "436281", "645253", "645274", "645251", "645254"],
  "imperial-nobility": ["645241", "645242", "645251", "645244", "645250"],
  khorne: ["440149", "585629", "436254", "582799"],
  lizardmen: ["436296", "596628", "436297", "436298"],
  "necromantic-horror": ["440138", "436300", "436301", "436302", "436303"],
  norse: ["585611", null, "585614", "585613", "585615", "585616"],
  nurgle: ["436310", "436311", "436312", "436313"],
  ogre: ["674154", "605358", "674153"],
  "old-world-alliance": [
    "645241",
    "645249",
    "645243",
    "645245",
    "645242",
    "645246",
    "645244",
    "645247",
    "645248",
    "645250",
    "436282",
  ],
  orc: ["585649", "585650", "585651", "585652", "436319", "585653"],
  "shambling-undead": ["436327", "440137", "436329", "436330", "436331"],
  skaven: ["585625", "585626", "436324", "436325", "436326"],
  slann: ["436346", "581225", "436348", "436349"],
  snotling: ["643392", "643395", "643396", "643393", "674155", "643466"],
  "tomb-kings": ["585607", "585608", "585609", "585610"],
  "underworld-denizens": [
    "585622",
    "643392",
    "585623",
    "585624",
    "634872",
    "436353",
    "436354",
    "436326",
  ],
  vampire: ["585630", "440133", "440133", "440133", null],
  "wood-elf": ["585618", "674156", "585619", "585621", "436338"],
};

const representatives: Record<string, string> = {
  amazon: "585645",
  "black-orc": "436319",
  bretonnian: "585587",
  "chaos-chosen": "436254",
  "chaos-dwarf": "436257",
  "chaos-renegade": "440149",
  "dark-elf": "674157",
  dwarf: "436265",
  "elven-union": "440308",
  gnome: "436282",
  goblin: "585617",
  halfling: "436281",
  "high-elf": "436286",
  human: "645251",
  "imperial-nobility": "645244",
  khorne: "436254",
  lizardmen: "436297",
  "necromantic-horror": "436303",
  norse: "585614",
  nurgle: "436312",
  ogre: "605358",
  "old-world-alliance": "645244",
  orc: "585652",
  "shambling-undead": "436331",
  skaven: "436325",
  slann: "436348",
  snotling: "643392",
  "tomb-kings": "585610",
  "underworld-denizens": "436353",
  vampire: "440133",
  "wood-elf": "585621",
};

const starAliases: Record<string, string> = {
  "count-luthor-von-drakenforg": "436443",
  "rumbelow-sheepskin": "595947",
  "varag-ghoul-chewer": "436489",
  "gretchen-wachter": "585593",
  "the-mighty-zug": "436472",
  "wilhelm-chaney": "436490",
};
const normalize = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const starIcons = new Map(
  Object.values(icons)
    .filter((icon) => icon.group === "Star Players")
    .map((icon) => [normalize(icon.label), icon]),
);

export function getPositionArtwork(positionId: string) {
  const separator = positionId.lastIndexOf("-");
  const id =
    positionArtwork[positionId.slice(0, separator)]?.[
      Number(positionId.slice(separator + 1))
    ];
  return id ? icons[id] : undefined;
}
export function getRosterArtwork(rosterId: string) {
  return icons[representatives[rosterId]];
}
export function getStarArtwork(starId: string) {
  return icons[starAliases[starId]] ?? starIcons.get(normalize(starId));
}
