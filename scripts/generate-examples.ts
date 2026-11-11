import { mkdirSync, writeFileSync } from "node:fs";
import { artworkSvg, examplePdf } from "../src/lib/seed";
const directory = "public/examples";
mkdirSync(directory, { recursive: true });
for (const kind of [
  "reference",
  "correct",
  "wrong-phone",
  "missing-element",
] as const) {
  const example = await examplePdf(kind);
  writeFileSync(`${directory}/juniper-${kind}.pdf`, example.bytes);
  if (example.preview)
    writeFileSync(
      `${directory}/juniper-${kind}.png`,
      Buffer.from(example.preview.split(",")[1], "base64"),
    );
}
writeFileSync(
  `${directory}/juniper-artwork.svg`,
  artworkSvg("202-555-0147", true),
);
console.log(
  "Original, labelled sample documents generated in public/examples. No private data.",
);
