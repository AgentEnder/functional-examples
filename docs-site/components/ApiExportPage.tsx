import type { LinkedApiExport } from 'vike-plugin-typedoc';
import { Link } from './Link';

export interface ApiExportPageProps {
  apiExport: LinkedApiExport;
  /** Link back to the package page */
  packagePath?: string;
  /** Package display name */
  packageName?: string;
}

/** Renders a type string as HTML (with links) or plain text fallback */
function TypeText({ html, text }: { html?: string; text: string }) {
  if (html && html !== text) {
    return <span dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return <>{text}</>;
}

export function ApiExportPage({
  apiExport,
  packagePath,
  packageName,
}: ApiExportPageProps) {
  return (
    <div>
      {/* Breadcrumb */}
      {packagePath && (
        <div className="bp-annotation mb-4 flex items-center gap-2">
          <Link
            href="/api"
            className="text-bp-line-dim hover:text-bp-line transition-colors"
          >
            API
          </Link>
          <span className="text-bp-line-dim/50">/</span>
          <Link
            href={packagePath}
            className="text-bp-line-dim hover:text-bp-line transition-colors"
          >
            {packageName}
          </Link>
          <span className="text-bp-line-dim/50">/</span>
          <span className="text-bp-line">{apiExport.name}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl text-bp-line-bright font-mono">
            {apiExport.name}
          </h1>
          <span className="bp-stamp text-bp-accent text-xs">
            {apiExport.kind}
          </span>
        </div>

        {apiExport.comment?.deprecated && (
          <div className="bg-amber-900/20 border border-amber-500/30 rounded px-3 py-2 mb-4 text-sm text-amber-300">
            <strong>Deprecated:</strong> {apiExport.comment.deprecated}
          </div>
        )}
      </div>

      {/* Signature */}
      {apiExport.signature && (
        <div className="mb-6">
          {apiExport.signatureCodeHtml ? (
            <div
              className="prose-blueprint"
              dangerouslySetInnerHTML={{ __html: apiExport.signatureCodeHtml }}
            />
          ) : (
            <pre className="bg-bp-surface/30 border border-bp-line-dim/20 rounded px-4 py-3 overflow-x-auto">
              <code className="text-sm text-bp-line font-mono">
                {apiExport.signature}
              </code>
            </pre>
          )}
        </div>
      )}

      {/* Description — use pre-rendered markdown HTML from the plugin */}
      {(apiExport.descriptionHtml || apiExport.description) && (
        <div className="mb-6">
          {apiExport.descriptionHtml ? (
            <div
              className="prose-blueprint"
              dangerouslySetInnerHTML={{ __html: apiExport.descriptionHtml }}
            />
          ) : (
            <p className="text-bp-line-dim">{apiExport.description}</p>
          )}
        </div>
      )}

      {/* Parameters */}
      {apiExport.parameters && apiExport.parameters.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-heading text-bp-line-bright mb-3 tracking-wider">
            PARAMETERS
          </h2>
          <div className="bg-[rgba(18,42,72,0.95)] border border-[rgba(200,220,240,0.2)] rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(200,220,240,0.25)]">
                  <th className="text-left px-4 py-2.5 text-bp-line-bright font-heading text-xs tracking-wider">
                    NAME
                  </th>
                  <th className="text-left px-4 py-2.5 text-bp-line-bright font-heading text-xs tracking-wider">
                    TYPE
                  </th>
                  <th className="text-left px-4 py-2.5 text-bp-line-bright font-heading text-xs tracking-wider">
                    DESCRIPTION
                  </th>
                </tr>
              </thead>
              <tbody>
                {apiExport.parameters.map((param) => (
                  <tr
                    key={param.name}
                    className="border-t border-[rgba(200,220,240,0.1)]"
                  >
                    <td className="px-4 py-2.5 font-mono text-bp-line text-[0.8125rem]">
                      {param.name}
                      {param.optional && (
                        <span className="text-bp-line-dim">?</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <code className="font-mono text-bp-accent text-xs bg-bp-paper-light px-1.5 py-0.5 rounded">
                        <TypeText html={param.typeHtml} text={param.type} />
                      </code>
                    </td>
                    <td className="px-4 py-2.5 text-bp-line-dim text-[0.8125rem]">
                      {param.description || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Return type */}
      {apiExport.returnType && (
        <div className="mb-6">
          <h2 className="text-lg font-heading text-bp-line-bright mb-2 tracking-wider">
            RETURNS
          </h2>
          {apiExport.returnTypeCodeHtml ? (
            <div
              className="prose-blueprint"
              dangerouslySetInnerHTML={{ __html: apiExport.returnTypeCodeHtml }}
            />
          ) : (
            <p className="font-mono text-bp-accent text-sm">
              <TypeText
                html={apiExport.returnTypeHtml}
                text={apiExport.returnType}
              />
            </p>
          )}
        </div>
      )}

      {/* Type Parameters */}
      {apiExport.typeParameters && apiExport.typeParameters.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-heading text-bp-line-bright mb-3 tracking-wider">
            TYPE PARAMETERS
          </h2>
          <ul className="space-y-2">
            {apiExport.typeParameters.map((tp) => (
              <li key={tp.name} className="text-sm">
                <code className="font-mono text-bp-line">{tp.name}</code>
                {tp.constraint && (
                  <span className="text-bp-line-dim">
                    {' '}
                    extends{' '}
                    <code className="font-mono text-bp-accent">
                      <TypeText html={tp.constraintHtml} text={tp.constraint} />
                    </code>
                  </span>
                )}
                {tp.default && (
                  <span className="text-bp-line-dim">
                    {' '}
                    ={' '}
                    <code className="font-mono text-bp-accent">
                      <TypeText html={tp.defaultHtml} text={tp.default} />
                    </code>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Properties */}
      {apiExport.properties && apiExport.properties.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-heading text-bp-line-bright mb-3 tracking-wider">
            PROPERTIES
          </h2>
          <div className="bg-[rgba(18,42,72,0.95)] border border-[rgba(200,220,240,0.2)] rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(200,220,240,0.25)]">
                  <th className="text-left px-4 py-2.5 text-bp-line-bright font-heading text-xs tracking-wider">
                    NAME
                  </th>
                  <th className="text-left px-4 py-2.5 text-bp-line-bright font-heading text-xs tracking-wider">
                    TYPE
                  </th>
                  <th className="text-left px-4 py-2.5 text-bp-line-bright font-heading text-xs tracking-wider">
                    DESCRIPTION
                  </th>
                </tr>
              </thead>
              <tbody>
                {apiExport.properties.map((prop) => (
                  <tr
                    key={prop.name}
                    className="border-t border-[rgba(200,220,240,0.1)]"
                  >
                    <td className="px-4 py-2.5 font-mono text-bp-line text-[0.8125rem]">
                      {prop.readonly && (
                        <span className="text-bp-line-dim">readonly </span>
                      )}
                      {prop.name}
                      {prop.optional && (
                        <span className="text-bp-line-dim">?</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <code className="font-mono text-bp-accent text-xs bg-bp-paper-light px-1.5 py-0.5 rounded">
                        <TypeText html={prop.typeHtml} text={prop.type} />
                      </code>
                    </td>
                    <td className="px-4 py-2.5 text-bp-line-dim text-[0.8125rem]">
                      {prop.description || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Methods */}
      {apiExport.methods && apiExport.methods.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-heading text-bp-line-bright mb-3 tracking-wider">
            METHODS
          </h2>
          <div className="space-y-4">
            {apiExport.methods.map((method) => (
              <div
                key={method.name}
                className="border border-bp-line-dim/20 rounded p-4"
              >
                <code className="text-sm font-mono text-bp-line block mb-2">
                  <TypeText
                    html={method.signatureHtml}
                    text={method.signature}
                  />
                </code>
                {method.description && (
                  <p className="text-sm text-bp-line-dim">
                    {method.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Examples — use pre-rendered syntax-highlighted HTML from the plugin */}
      {apiExport.examplesHtml && apiExport.examplesHtml.length > 0 ? (
        <div className="mb-6">
          <h2 className="text-lg font-heading text-bp-line-bright mb-3 tracking-wider">
            EXAMPLES
          </h2>
          {apiExport.examplesHtml.map((html, i) => (
            <div
              key={i}
              className="prose-blueprint mb-3"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ))}
        </div>
      ) : apiExport.comment?.examples &&
        apiExport.comment.examples.length > 0 ? (
        <div className="mb-6">
          <h2 className="text-lg font-heading text-bp-line-bright mb-3 tracking-wider">
            EXAMPLES
          </h2>
          {apiExport.comment.examples.map((example, i) => (
            <pre
              key={i}
              className="bg-bp-surface/30 border border-bp-line-dim/20 rounded px-4 py-3 mb-3 overflow-x-auto"
            >
              <code className="text-sm text-bp-line font-mono">{example}</code>
            </pre>
          ))}
        </div>
      ) : null}

      {/* Remarks — use pre-rendered markdown HTML from the plugin */}
      {apiExport.remarksHtml ? (
        <div className="mb-6">
          <h2 className="text-lg font-heading text-bp-line-bright mb-3 tracking-wider">
            REMARKS
          </h2>
          <div
            className="prose-blueprint"
            dangerouslySetInnerHTML={{ __html: apiExport.remarksHtml }}
          />
        </div>
      ) : apiExport.comment?.remarks ? (
        <div className="mb-6">
          <h2 className="text-lg font-heading text-bp-line-bright mb-3 tracking-wider">
            REMARKS
          </h2>
          <p className="text-bp-line-dim">{apiExport.comment.remarks}</p>
        </div>
      ) : null}

      {/* See also */}
      {apiExport.comment?.see && apiExport.comment.see.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-heading text-bp-line-bright mb-2 tracking-wider">
            SEE ALSO
          </h2>
          <ul className="list-disc list-inside text-sm text-bp-line-dim">
            {apiExport.comment.see.map((ref, i) => (
              <li key={i}>{ref}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
