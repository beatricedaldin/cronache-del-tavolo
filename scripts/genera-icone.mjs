// Genera le icone della PWA in public/icons. Uso: pnpm icone
import { writeFile } from "node:fs/promises";
import { createElement as h } from "react";
import { ImageResponse } from "next/og.js";

function icon(size) {
  const s = (n) => Math.round((n / 512) * size);
  // Fondo a tutta pagina (le icone "maskable" vengono ritagliate dal telefono):
  // il disegno resta nel 60% centrale, la zona sicura.
  return h(
    "div",
    {
      style: {
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 50% 38%, #2f3f8f 0%, #1a2140 55%, #0f1426 100%)",
      },
    },
    // alone
    h("div", {
      style: {
        position: "absolute",
        width: s(300),
        height: s(300),
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(227,187,85,0.35) 0%, rgba(227,187,85,0) 70%)",
      },
    }),
    // cristallo esterno
    h("div", {
      style: {
        position: "absolute",
        width: s(190),
        height: s(190),
        transform: "rotate(45deg)",
        borderRadius: s(18),
        background: "linear-gradient(135deg, #f6dc8a 0%, #e3bb55 45%, #b98a1f 100%)",
        boxShadow: `0 0 ${s(40)}px rgba(227,187,85,0.6)`,
      },
    }),
    // faccetta interna
    h("div", {
      style: {
        position: "absolute",
        width: s(96),
        height: s(96),
        transform: "rotate(45deg)",
        borderRadius: s(8),
        background: "linear-gradient(135deg, #fff6d6 0%, #f0c96a 100%)",
      },
    }),
    // scintilla
    h("div", {
      style: {
        position: "absolute",
        top: s(132),
        left: s(330),
        width: s(26),
        height: s(26),
        transform: "rotate(45deg)",
        background: "#fff6d6",
        borderRadius: s(3),
      },
    }),
  );
}

for (const [name, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
  const res = new ImageResponse(icon(size), { width: size, height: size });
  await writeFile(`public/icons/${name}`, Buffer.from(await res.arrayBuffer()));
  console.log("scritta", name);
}
