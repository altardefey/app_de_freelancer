// preserva os acentos do português na codificação WinAnsi da fonte Courier
const winAnsi = "€\u0000‚ƒ„…†‡ˆ‰Š‹Œ\u0000Ž\u0000\u0000‘’“”•–—˜™š›œ\u0000žŸ";

function pdfText(value: string) {
  return Array.from(value, (char) => {
    const code = char.charCodeAt(0);
    if (code >= 32 && code <= 126) return char.replace(/[()\\]/g, "\\$&");
    const index = winAnsi.indexOf(char);
    const byte = code >= 160 && code <= 255 ? code : index >= 0 && code >= 32 ? index + 128 : 63;
    return "\\" + byte.toString(8).padStart(3, "0");
  }).join("");
}

export function makeQuotePdf(sections: string[]) {
  const lines = sections.join("\n\n").normalize("NFC").replace(/\r\n?/g, "\n").replace(/\t/g, " ").split("\n")
    .flatMap((line) => line.match(/.{1,72}(?: |$)|.{1,72}/gu) ?? [""]);
  const pages = [];
  for (let start = 0; start < lines.length; start += 44) {
    const content = lines.slice(start, start + 44).map((line) => `(${pdfText(line)}) Tj T*`).join("\n");
    pages.push(`BT /F1 11 Tf 17 TL 48 790 Td\n${content}\nET`);
  }

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(" ")}] >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
  ];
  for (const content of pages) {
    const streamId = objects.length + 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  }

  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return String(offset).padStart(10, "0") + " 00000 n \n";
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return new Blob([pdf], { type: "application/pdf" });
}
