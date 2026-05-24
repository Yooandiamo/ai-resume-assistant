const MAX_AI_TEXT_LENGTH = 32000;

export function compactForAi(text = "", limit = MAX_AI_TEXT_LENGTH) {
  if (text.length <= limit) return text;
  const head = text.slice(0, Math.floor(limit * 0.65));
  const tail = text.slice(-Math.floor(limit * 0.25));
  return `${head}\n\n【中间内容过长，已自动省略部分文本以提升 AI 处理速度】\n\n${tail}`;
}
