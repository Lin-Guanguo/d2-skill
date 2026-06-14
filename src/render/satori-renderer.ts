import React, { type CSSProperties, type ReactNode } from 'react';
import satori from 'satori';
import { imageUrlToDataUrl } from './assets.js';
import { loadRenderFont } from './font.js';
import type {
  RenderDocument,
  RenderCardGridSection,
  RenderListSection,
  RenderMetric,
  RenderSection,
  RenderStatGridSection,
  RenderTableSection,
} from './render-document.js';
import { renderTheme } from './theme.js';

const h = React.createElement;

function baseStyle(style: CSSProperties = {}): CSSProperties {
  return {
    boxSizing: 'border-box',
    display: 'flex',
    ...style,
  };
}

function text(value: unknown) {
  return value === undefined || value === null || value === '' ? '—' : String(value);
}

function metricCard(metric: RenderMetric, index: number) {
  const marginLeft = index % 4 === 0 ? 0 : 14;
  const marginTop = index < 4 ? 0 : 14;

  return h(
    'div',
    {
      key: `${metric.label}-${index}`,
      style: baseStyle({
        width: 232,
        minHeight: 102,
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '15px 20px',
        marginLeft,
        marginTop,
        borderRadius: 22,
        border: `1px solid ${renderTheme.colors.border}`,
        backgroundColor: renderTheme.colors.panelSoft,
      }),
    },
    h(
      'div',
      {
        style: baseStyle({
          fontSize: 21,
          lineHeight: 1.2,
          color: renderTheme.colors.muted,
        }),
      },
      metric.label,
    ),
    h(
      'div',
      {
        style: baseStyle({
          alignItems: 'flex-end',
        }),
      },
      h(
        'div',
        {
          style: baseStyle({
            fontSize: 38,
            lineHeight: 1,
            fontWeight: 700,
            color: renderTheme.colors.text,
          }),
        },
        metric.value,
      ),
      metric.detail
        ? h(
            'div',
            {
              style: baseStyle({
                marginLeft: 10,
                marginBottom: 4,
                fontSize: 20,
                color: renderTheme.colors.subtle,
              }),
            },
            metric.detail,
          )
        : null,
    ),
  );
}

function sectionShell(section: RenderSection, children: ReactNode) {
  return h(
    'div',
    {
      key: section.title,
      style: baseStyle({
        flexDirection: 'column',
        padding: 22,
        marginTop: 18,
        borderRadius: 26,
        border: `1px solid ${renderTheme.colors.border}`,
        backgroundColor: renderTheme.colors.panel,
      }),
    },
    h(
      'div',
      {
        style: baseStyle({
          marginBottom: 12,
          fontSize: 27,
          fontWeight: 700,
          color: renderTheme.colors.text,
        }),
      },
      section.title,
    ),
    children,
  );
}

function renderStatGrid(section: RenderStatGridSection) {
  return sectionShell(
    section,
    h(
      'div',
      {
        style: baseStyle({
          flexDirection: 'row',
          flexWrap: 'wrap',
        }),
      },
      section.metrics.map((metric, index) =>
        h(
          'div',
          {
            key: `${metric.label}-${index}`,
            style: baseStyle({
              width: 300,
              flexDirection: 'column',
              padding: '14px 16px',
              marginLeft: index % 3 === 0 ? 0 : 12,
              marginTop: index < 3 ? 0 : 12,
              borderRadius: 18,
              backgroundColor: 'rgba(255, 255, 255, 0.055)',
            }),
          },
          h(
            'div',
            {
              style: baseStyle({
                fontSize: 19,
                color: renderTheme.colors.muted,
              }),
            },
            metric.label,
          ),
          h(
            'div',
            {
              style: baseStyle({
                marginTop: 6,
                fontSize: 31,
                fontWeight: 700,
                color: renderTheme.colors.text,
              }),
            },
            metric.value,
          ),
        ),
      ),
    ),
  );
}

function renderTable(section: RenderTableSection) {
  const tableWidth = section.columns.reduce((sum, column) => sum + column.width, 0);

  return sectionShell(
    section,
    h(
      'div',
      {
        style: baseStyle({
          width: tableWidth,
          flexDirection: 'column',
        }),
      },
      h(
        'div',
        {
          style: baseStyle({
            flexDirection: 'row',
            paddingBottom: 10,
            borderBottom: `1px solid ${renderTheme.colors.border}`,
          }),
        },
        section.columns.map((column) =>
          h(
            'div',
            {
              key: column.key,
              style: baseStyle({
                width: column.width,
                justifyContent:
                  column.align === 'right'
                    ? 'flex-end'
                    : column.align === 'center'
                      ? 'center'
                      : 'flex-start',
                fontSize: 18,
                color: renderTheme.colors.subtle,
              }),
            },
            column.label,
          ),
        ),
      ),
      section.rows.map((row, rowIndex) =>
        h(
          'div',
          {
            key: rowIndex,
            style: baseStyle({
              flexDirection: 'row',
              alignItems: 'center',
            minHeight: 37,
              borderBottom:
                rowIndex === section.rows.length - 1
                  ? '0 solid transparent'
                  : '1px solid rgba(255, 255, 255, 0.07)',
            }),
          },
          section.columns.map((column) =>
            h(
              'div',
              {
                key: column.key,
                style: baseStyle({
                  width: column.width,
                  justifyContent:
                    column.align === 'right'
                      ? 'flex-end'
                      : column.align === 'center'
                        ? 'center'
                        : 'flex-start',
                  fontSize: 19,
                  fontWeight: column.key === 'name' ? 700 : 400,
                  color: column.key === 'name' ? renderTheme.colors.text : renderTheme.colors.muted,
                }),
              },
              text(row[column.key]),
            ),
          ),
        ),
      ),
    ),
  );
}

function renderList(section: RenderListSection) {
  return sectionShell(
    section,
    h(
      'div',
      {
        style: baseStyle({
          flexDirection: 'column',
        }),
      },
      section.items.map((item, index) =>
        h(
          'div',
          {
            key: `${item.title}-${index}`,
            style: baseStyle({
              minHeight: 50,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '7px 0',
              borderBottom:
                index === section.items.length - 1
                  ? '0 solid transparent'
                  : '1px solid rgba(255, 255, 255, 0.07)',
            }),
          },
          h(
            'div',
            {
              style: baseStyle({
                flexDirection: 'column',
                width: item.value ? 650 : 900,
              }),
            },
            h(
              'div',
              {
                style: baseStyle({
                  fontSize: 21,
                  fontWeight: 700,
                  color: renderTheme.colors.text,
                }),
              },
              item.title,
            ),
            item.detail
              ? h(
                  'div',
                  {
                    style: baseStyle({
                      marginTop: 4,
                      fontSize: 16,
                      color: renderTheme.colors.subtle,
                    }),
                  },
                  item.detail,
                )
              : null,
          ),
          item.value
            ? h(
                'div',
                {
                  style: baseStyle({
                    justifyContent: 'flex-end',
                    width: 230,
                    fontSize: 22,
                    fontWeight: 700,
                    color: renderTheme.colors.accent,
                  }),
                },
                item.value,
              )
            : null,
        ),
      ),
    ),
  );
}

function renderCardGrid(section: RenderCardGridSection, imageDataUrls: ReadonlyMap<string, string>) {
  const columns = section.columns ?? 2;
  const cardWidth = section.cardWidth ?? 448;
  const cardHeight = section.cardHeight ?? 166;

  return sectionShell(
    section,
    h(
      'div',
      {
        style: baseStyle({
          flexDirection: 'row',
          flexWrap: 'wrap',
        }),
      },
      section.cards.map((card, index) => {
        const imageDataUrl = card.imageUrl ? imageDataUrls.get(card.imageUrl) : undefined;

        return h(
          'div',
          {
            key: `${card.title}-${index}`,
            style: baseStyle({
              position: 'relative',
              width: cardWidth,
              height: cardHeight,
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden',
              padding: 20,
              marginLeft: index % columns === 0 ? 0 : 16,
              marginTop: index < columns ? 0 : 16,
              borderRadius: 22,
              border: `1px solid ${renderTheme.colors.border}`,
              backgroundColor: renderTheme.colors.panelSoft,
            }),
          },
          imageDataUrl
            ? h('img', {
                src: imageDataUrl,
                style: {
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: cardWidth,
                  height: cardHeight,
                  objectFit: 'cover',
                  opacity: 0.34,
                },
              })
            : null,
          h('div', {
            style: baseStyle({
              position: 'absolute',
              left: 0,
              top: 0,
              width: cardWidth,
              height: cardHeight,
              background: 'linear-gradient(90deg, rgba(12,15,20,0.95) 0%, rgba(12,15,20,0.82) 58%, rgba(12,15,20,0.5) 100%)',
            }),
          }),
          h(
            'div',
            {
              style: baseStyle({
                position: 'relative',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }),
            },
            h(
              'div',
              {
                style: baseStyle({
                  flexDirection: 'column',
                  width: 292,
                }),
              },
              h(
                'div',
                {
                  style: baseStyle({
                    fontSize: 25,
                    fontWeight: 700,
                    color: renderTheme.colors.text,
                  }),
                },
                card.title,
              ),
              card.subtitle
                ? h(
                    'div',
                    {
                      style: baseStyle({
                        marginTop: 6,
                        fontSize: 15,
                        color: renderTheme.colors.muted,
                      }),
                    },
                    card.subtitle,
                  )
                : null,
            ),
            card.badge
              ? h(
                  'div',
                  {
                    style: baseStyle({
                      borderRadius: 999,
                      padding: '6px 10px',
                      backgroundColor: 'rgba(232, 199, 102, 0.16)',
                      border: '1px solid rgba(232, 199, 102, 0.34)',
                      color: renderTheme.colors.accent,
                      fontSize: 14,
                      fontWeight: 700,
                    }),
                  },
                  card.badge,
                )
              : null,
          ),
          h(
            'div',
            {
              style: baseStyle({
                position: 'relative',
                flexDirection: 'row',
                flexWrap: 'wrap',
              }),
            },
            card.metrics.slice(0, 4).map((metricItem, metricIndex) => {
              const compactMetric = card.metrics.length > 2;
              const metricWidth = compactMetric
                ? Math.floor((cardWidth - 64) / 4)
                : Math.floor((cardWidth - 66) / 2);
              return h(
                'div',
                {
                  key: `${metricItem.label}-${metricIndex}`,
                  style: baseStyle({
                    width: metricWidth,
                    flexDirection: 'column',
                    marginLeft: metricIndex === 0 ? 0 : compactMetric ? 8 : 26,
                  }),
                },
                h(
                  'div',
                  {
                    style: baseStyle({
                      fontSize: 14,
                      color: renderTheme.colors.subtle,
                    }),
                  },
                  metricItem.label,
                ),
                h(
                  'div',
                  {
                    style: baseStyle({
                      marginTop: 4,
                      fontSize: 20,
                      fontWeight: 700,
                      color: renderTheme.colors.text,
                    }),
                  },
                  metricItem.value,
                ),
              );
            }),
          ),
        );
      }),
    ),
  );
}

function renderSection(section: RenderSection, imageDataUrls: ReadonlyMap<string, string>) {
  if (section.kind === 'stat-grid') return renderStatGrid(section);
  if (section.kind === 'table') return renderTable(section);
  if (section.kind === 'card-grid') return renderCardGrid(section, imageDataUrls);
  return renderList(section);
}

function collectImageUrls(document: RenderDocument) {
  const urls = new Set<string>();
  if (document.backgroundImageUrl) {
    urls.add(document.backgroundImageUrl);
  }
  for (const section of document.sections) {
    if (section.kind === 'card-grid') {
      for (const card of section.cards) {
        if (card.imageUrl) {
          urls.add(card.imageUrl);
        }
      }
    }
  }
  return [...urls];
}

async function loadImageDataUrls(document: RenderDocument) {
  const entries = await Promise.all(
    collectImageUrls(document).map(async (url) => [url, await imageUrlToDataUrl(url)] as const),
  );
  return new Map(
    entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
  );
}

async function renderElement(document: RenderDocument) {
  const imageDataUrls = await loadImageDataUrls(document);
  const backgroundImage = document.backgroundImageUrl
    ? imageDataUrls.get(document.backgroundImageUrl)
    : undefined;
  const { width, height } = document.preset;

  return h(
    'div',
    {
      style: baseStyle({
        width,
        height,
        position: 'relative',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: '48px 54px 34px',
        backgroundColor: renderTheme.colors.background,
        color: renderTheme.colors.text,
        fontFamily: renderTheme.fontFamily,
      }),
    },
    backgroundImage
      ? h('img', {
          src: backgroundImage,
          style: {
            position: 'absolute',
            left: 0,
            top: 0,
            width,
            height: 490,
            objectFit: 'cover',
            opacity: 0.34,
          },
        })
      : null,
    h('div', {
      style: baseStyle({
        position: 'absolute',
        left: 0,
        top: 0,
        width,
        height,
        background: 'linear-gradient(180deg, rgba(11,13,16,0.24) 0%, rgba(11,13,16,0.96) 30%, #0b0d10 100%)',
      }),
    }),
    h(
      'div',
      {
        style: baseStyle({
          position: 'relative',
          flexDirection: 'column',
          width: '100%',
        }),
      },
      h(
        'div',
        {
          style: baseStyle({
            fontSize: 22,
            letterSpacing: 0,
            textTransform: 'uppercase',
            color: renderTheme.colors.accent,
            fontWeight: 700,
          }),
        },
        document.kicker ?? 'D2 Skill',
      ),
      h(
        'div',
        {
          style: baseStyle({
            marginTop: 12,
            fontSize: 62,
            lineHeight: 1.02,
            fontWeight: 700,
            color: renderTheme.colors.text,
          }),
        },
        document.title,
      ),
      document.subtitle
        ? h(
            'div',
            {
              style: baseStyle({
                marginTop: 12,
                fontSize: 23,
                color: renderTheme.colors.muted,
              }),
            },
            document.subtitle,
          )
        : null,
      h(
        'div',
        {
          style: baseStyle({
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginTop: 30,
          }),
        },
        document.metrics.map(metricCard),
      ),
      h(
        'div',
        {
          style: baseStyle({
            flexDirection: 'column',
            marginTop: 24,
          }),
        },
        document.sections.map((section) => renderSection(section, imageDataUrls)),
      ),
      document.footer
        ? h(
            'div',
            {
              style: baseStyle({
                marginTop: 24,
                justifyContent: 'center',
                fontSize: 18,
                color: renderTheme.colors.subtle,
              }),
            },
            document.footer,
          )
        : null,
    ),
  );
}

export async function renderDocumentToSvg(document: RenderDocument) {
  const font = await loadRenderFont();
  return satori(await renderElement(document), {
    width: document.preset.width,
    height: document.preset.height,
    fonts: font.fonts,
  });
}
