'use strict';
/**
 * Remove PowerPoint notes parts from a pptx package without relying on
 * platform zip/unzip binaries. ChatGPT Agent Builder images vary, so PPTX
 * package edits must be pure Node.
 */
const fs = require('fs');
const JSZip = require('jszip');

function removeMatchingFiles(zip, predicate) {
  const names = Object.keys(zip.files);
  let removed = 0;
  for (const name of names) {
    if (predicate(name, zip.files[name])) {
      zip.remove(name);
      removed++;
    }
  }
  return removed;
}

async function rewriteXml(zip, fileName, replacers) {
  const entry = zip.file(fileName);
  if (!entry) return false;
  let xml = await entry.async('string');
  for (const [rx, replacement] of replacers) {
    xml = xml.replace(rx, replacement);
  }
  zip.file(fileName, xml);
  return true;
}

async function stripPptxNotes(pptxPath) {
  if (!pptxPath || !fs.existsSync(pptxPath)) return false;

  const zip = await JSZip.loadAsync(fs.readFileSync(pptxPath));

  removeMatchingFiles(zip, (name) =>
    /^ppt\/notesSlides\//.test(name) ||
    /^ppt\/notesMasters\//.test(name)
  );

  await rewriteXml(zip, '[Content_Types].xml', [
    [/<Override\b[^>]*PartName="\/ppt\/notesSlides\/[^"]+"[^>]*\/>\s*/g, ''],
    [/<Override\b[^>]*PartName="\/ppt\/notesMasters\/[^"]+"[^>]*\/>\s*/g, ''],
  ]);

  await rewriteXml(zip, 'ppt/_rels/presentation.xml.rels', [
    [/<Relationship\b[^>]*Type="[^"]*\/notesMaster"[^>]*\/>\s*/g, ''],
  ]);

  const relFiles = Object.keys(zip.files).filter((name) =>
    /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(name)
  );
  for (const relFile of relFiles) {
    await rewriteXml(zip, relFile, [
      [/<Relationship\b[^>]*Type="[^"]*\/notesSlide"[^>]*\/>\s*/g, ''],
    ]);
  }

  const out = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  fs.writeFileSync(pptxPath, out);
  return true;
}

module.exports = { stripPptxNotes };
