
import * as mammoth from 'mammoth';

export const convertDocxToMd = async (
  arrayBuffer: ArrayBuffer,
  onLog: (msg: string, level?: 'info' | 'success' | 'warning' | 'error') => void
): Promise<string> => {
  onLog("Analyzing Word structure and identifying assets...", "info");

  let imageCounter = 1;
  const options = {
    styleMap: [
      "p[style-name='Code'] => pre > code:fresh",
      "p[style-name='Source Code'] => pre > code:fresh",
      "p[style-name='Consolas'] => code",
      "r[style-name='Code Text'] => code",
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh"
    ],
    // Instead of embedding massive Base64 strings, we use clean placeholders.
    // This fixes the "messy export" issue and prepares the doc for AI organization.
    convertImage: mammoth.images.imgElement((element) => {
      const id = imageCounter++;
      onLog(`Asset detected: Image #${id}`, "success");
      return Promise.resolve({
        src: `IMAGE_PATH_PLACEHOLDER_${id}`
      });
    })
  };

  try {
    const result = await (mammoth as any).convertToMarkdown({ arrayBuffer }, options);
    let markdown = result.value;

    onLog("Refining document structure...", "info");

    // 1. Convert mammoth's raw placeholders into proper Markdown image syntax
    // The AI polisher will later finalize the naming (e.g., images/figure_x.png)
    markdown = markdown.replace(/src="IMAGE_PATH_PLACEHOLDER_(\d+)"/g, '![](images/figure_$1.png)');
    markdown = markdown.replace(/!\[\]\(IMAGE_PATH_PLACEHOLDER_(\d+)\)/g, '![](images/figure_$1.png)');

    // 2. Initial escape cleanup to help the AI model process the text more efficiently
    markdown = markdown.replace(/\\([_()\[\]"'])/g, '$1');
    markdown = markdown.replace(/\\\./g, '.');
    markdown = markdown.replace(/\\-/g, '-');

    onLog("Base Markdown generated successfully.", "success");
    return markdown;
  } catch (error) {
    onLog(`Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    throw error;
  }
};
