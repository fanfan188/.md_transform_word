
import { GoogleGenAI } from "@google/genai";

export const polishMarkdown = async (content: string): Promise<string> => {
  try {
    // Create a new GoogleGenAI instance right before the call to ensure the latest API key is used
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Use gemini-3-pro-preview for complex text tasks such as technical document organization
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `你是一位专业的文档整理专家。请将提供的内容整理为 Markdown 文档，并严格遵守以下要求：

- 禁止生成 base64 或 data:image 格式的图片
- 不内嵌任何图片二进制内容
- 所有图片仅以 Markdown 图片路径形式表示，例如：![](images/figure_x.png)
- 对于 Word 中的图表、流程图、可视化结果，只保留图片占位引用
- 如果图片无法直接引用，请用【图 X：内容描述】的文字说明代替
- 彻底清除所有冗余的反斜杠转义字符（如 p\_value 应为 p_value，print\( 应为 print(）
- 确保代码块（Python/Data Science）被正确包裹在 \`\`\`python 中
- 保持 Markdown 结构清晰，适合后续转换为 Word / PDF / LaTeX

请只输出 Markdown 源文本，不附加任何解释说明或开场白。

待处理内容如下：
${content}`,
    });
    
    // Access the generated text content directly using the .text property
    return response.text || content;
  } catch (error) {
    console.error("AI Polishing failed:", error);
    return content;
  }
};
