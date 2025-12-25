
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  ImageRun, 
  ExternalHyperlink,
  BorderStyle,
  AlignmentType
} from 'docx';
import { marked } from 'marked';

export const convertToDocx = async (
  markdown: string, 
  images: Map<string, ArrayBuffer>,
  onLog: (msg: string, level?: 'info' | 'success' | 'warning' | 'error') => void
): Promise<Blob> => {
  onLog("Initializing DOCX engine...", "info");
  
  const tokens = marked.lexer(markdown);
  const sections: any[] = [];

  const resolveImage = (href: string): ArrayBuffer | undefined => {
    // 1. Try exact match (best for folder structures)
    if (images.has(href)) return images.get(href);
    
    // 2. Try normalized path (remove leading ./ or /)
    const normalized = href.replace(/^\.?\//, '');
    if (images.has(normalized)) return images.get(normalized);
    
    // 3. Try filename only fallback
    const fileName = href.split('/').pop() || '';
    if (images.has(fileName)) return images.get(fileName);

    // 4. Deep search (find any key ending with the requested path)
    for (let [key, val] of images.entries()) {
      if (key.endsWith(href) || key.endsWith(normalized)) return val;
    }
    
    return undefined;
  };

  for (const token of tokens) {
    switch (token.type) {
      case 'heading':
        sections.push(new Paragraph({
          text: token.text,
          heading: token.depth === 1 ? HeadingLevel.HEADING_1 : 
                   token.depth === 2 ? HeadingLevel.HEADING_2 : 
                   token.depth === 3 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4,
          spacing: { before: 400, after: 200 }
        }));
        break;

      case 'paragraph': {
        const children: any[] = [];
        
        if (token.tokens) {
          for (const subToken of token.tokens) {
            if (subToken.type === 'image') {
              const imgData = resolveImage(subToken.href);
              
              if (imgData) {
                onLog(`Matched asset: ${subToken.href}`, "success");
                children.push(new ImageRun({
                  data: imgData,
                  transformation: { width: 500, height: 300 },
                }));
              } else {
                onLog(`Image link broken or missing: ${subToken.href}`, "warning");
                children.push(new TextRun({ text: `\n[IMAGE NOT LOADED: ${subToken.href}]\n`, color: "FF0000", bold: true }));
              }
            } else if (subToken.type === 'link') {
               children.push(new ExternalHyperlink({
                 children: [new TextRun({ text: subToken.text, style: "Hyperlink", color: "0563C1", underline: {} })],
                 link: subToken.href
               }));
            } else if (subToken.type === 'strong') {
               children.push(new TextRun({ text: subToken.text, bold: true }));
            } else if (subToken.type === 'em') {
               children.push(new TextRun({ text: subToken.text, italic: true }));
            } else if (subToken.type === 'codespan') {
               children.push(new TextRun({ 
                 text: subToken.text, 
                 font: "Consolas", 
                 shading: { fill: "F3F4F6" },
                 color: "D11111"
               }));
            } else if (subToken.type === 'text') {
               children.push(new TextRun(subToken.text || ''));
            } else if (subToken.type === 'br') {
               children.push(new TextRun({ break: 1 }));
            }
          }
        } else {
          children.push(new TextRun(token.text));
        }

        sections.push(new Paragraph({ children, spacing: { after: 150 } }));
        break;
      }

      case 'list':
        token.items.forEach((item: any) => {
          sections.push(new Paragraph({
            text: item.text,
            bullet: { level: 0 },
            spacing: { after: 100 }
          }));
        });
        break;

      case 'code': {
        const lines = token.text.split('\n');
        const codeRuns = lines.map((line, index) => new TextRun({
          text: line,
          font: "Consolas",
          size: 18,
          break: index > 0 ? 1 : 0,
        }));

        sections.push(new Paragraph({
          children: codeRuns,
          shading: { fill: "F8F9FA" },
          border: {
            top: { color: "E2E8F0", space: 8, style: BorderStyle.SINGLE, size: 4 },
            bottom: { color: "E2E8F0", space: 8, style: BorderStyle.SINGLE, size: 4 },
            left: { color: "E2E8F0", space: 8, style: BorderStyle.SINGLE, size: 4 },
            right: { color: "E2E8F0", space: 8, style: BorderStyle.SINGLE, size: 4 },
          },
          spacing: { before: 240, after: 240, line: 320 },
          indent: { left: 240, right: 240 },
        }));
        break;
      }

      case 'hr':
        sections.push(new Paragraph({
          border: { bottom: { color: "CBD5E1", space: 1, style: BorderStyle.SINGLE, size: 6 } },
          spacing: { before: 200, after: 200 }
        }));
        break;

      default:
        if (token.text) {
          sections.push(new Paragraph({ text: token.text }));
        }
    }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: sections,
    }],
  });

  onLog("Finalizing DOCX binary data...", "info");
  return await Packer.toBlob(doc);
};
