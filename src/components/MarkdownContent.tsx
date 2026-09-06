import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';

const joinClass = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

interface MarkdownContentProps {
  content: string;
  className?: string;
  /** Define estilo específico quando renderizado sobre fundo colorido (ex: tema TV escuro) */
  onColored?: boolean;
  sizeClass?: string;
}

/**
 * Renderiza conteúdo com suporte a Markdown nas áreas de comunicação
 * (avisos, comunicados, notas gerais, ocorrências e avisos de rodapé).
 * Preserva quebras de linha (\n) e formatações ricas.
 */
export const MarkdownContent: React.FC<MarkdownContentProps> = ({
  content,
  className,
  onColored = false,
  sizeClass,
}) => {
  const formattedContent = useMemo(() => {
    if (!content) return '';
    // Normalize newlines and ensure single line breaks within paragraphs become visible line breaks
    return content.replace(/(\r\n|\n|\r)/g, '  \n');
  }, [content]);

  if (!content || !content.trim()) {
    return null;
  }

  return (
    <div className={joinClass('markdown-content', onColored && 'markdown-on-colored', sizeClass, className)}>
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="whitespace-pre-line leading-relaxed my-0.5">{children}</p>,
          ul: ({ children }) => <ul className="my-1.5 list-disc pl-4 space-y-0.5 text-left">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 list-decimal pl-4 space-y-0.5 text-left">{children}</ol>,
          li: ({ children }) => <li className="leading-snug">{children}</li>,
          strong: ({ children }) => <strong className="font-black">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="underline font-bold hover:opacity-80">
              {children}
            </a>
          ),
          h1: ({ children }) => <p className="markdown-heading font-black text-sm uppercase my-1">{children}</p>,
          h2: ({ children }) => <p className="markdown-heading font-black text-xs uppercase my-1">{children}</p>,
          h3: ({ children }) => <p className="markdown-heading font-extrabold text-xs my-0.5">{children}</p>,
          blockquote: ({ children }) => (
            <blockquote className="my-1.5 pl-2.5 border-l-2 border-current italic opacity-90">{children}</blockquote>
          ),
          code: ({ children }) => (
            <code className="px-1 py-0.5 rounded text-[0.9em] font-mono bg-black/10 dark:bg-white/15">{children}</code>
          ),
        }}
      >
        {formattedContent}
      </ReactMarkdown>
    </div>
  );
};

