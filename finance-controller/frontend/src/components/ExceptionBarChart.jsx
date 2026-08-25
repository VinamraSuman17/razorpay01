import React from 'react';
import { Bar } from '@visx/shape';
import { Group } from '@visx/group';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { scaleBand, scaleLinear } from '@visx/scale';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { ParentSize } from '@visx/responsive';

const tooltipStyles = {
  ...defaultStyles,
  backgroundColor: '#18181B',
  color: '#FAFAFA',
  borderRadius: '0px',
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: 'bold',
  boxShadow: '4px 4px 0px 0px #18181B',
  border: '2px solid #FAFAFA',
  zIndex: 1000,
  pointerEvents: 'none',
};

function ExceptionBarChartInner({ width, height, exceptionsList = [] }) {
  const {
    tooltipOpen,
    tooltipLeft,
    tooltipTop,
    tooltipData,
    hideTooltip,
    showTooltip,
  } = useTooltip();

  // Aggregate exceptions by operational category
  const counts = {};
  exceptionsList.forEach((e) => {
    const cat = e.category ? e.category.replace(/_/g, ' ') : 'UNCLASSIFIED';
    counts[cat] = (counts[cat] || 0) + 1;
  });

  // Convert to array and sort descending by count
  const data = Object.keys(counts)
    .map((cat) => ({ category: cat, count: counts[cat] }))
    .sort((a, b) => b.count - a.count);

  if (width < 10 || height < 10) return null;

  const margin = { top: 10, right: 35, bottom: 25, left: 160 };
  const xMax = width - margin.left - margin.right;
  const yMax = height - margin.top - margin.bottom;

  // Scales
  const yScale = scaleBand({
    domain: data.map((d) => d.category),
    range: [0, yMax],
    padding: 0.3,
  });

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const xScale = scaleLinear({
    domain: [0, maxCount * 1.15],
    range: [0, Math.max(xMax, 10)],
  });

  return (
    <div className="relative w-full h-full">
      <svg width={width} height={height}>
        <Group top={margin.top} left={margin.left}>
          {data.map((d) => {
            const barWidth = xScale(d.count);
            const barHeight = yScale.bandwidth();
            const barY = yScale(d.category);

            return (
              <Group key={d.category}>
                <Bar
                  x={0}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  fill="#18181B"
                  stroke="#18181B"
                  strokeWidth={2}
                  rx={0}
                  className="transition-opacity duration-150 hover:opacity-80 cursor-pointer"
                  onMouseMove={(event) => {
                    const svg = event.currentTarget.ownerSVGElement;
                    const rect = svg.getBoundingClientRect();
                    showTooltip({
                      tooltipLeft: event.clientX - rect.left,
                      tooltipTop: event.clientY - rect.top,
                      tooltipData: d,
                    });
                  }}
                  onMouseLeave={hideTooltip}
                />
                {/* Direct count label at end of bar */}
                <text
                  x={barWidth + 8}
                  y={barY + barHeight / 2}
                  dy="0.35em"
                  fontSize={12}
                  fontWeight={900}
                  fill="#18181B"
                  fontFamily="ui-monospace, monospace"
                >
                  {d.count}
                </text>
              </Group>
            );
          })}

          <AxisLeft
            scale={yScale}
            stroke="#18181B"
            strokeWidth={2}
            tickStroke="#18181B"
            tickLabelProps={() => ({
              fill: '#18181B',
              fontSize: 11,
              fontWeight: 800,
              textAnchor: 'end',
              dy: '0.33em',
            })}
          />

          <AxisBottom
            top={yMax}
            scale={xScale}
            stroke="#18181B"
            strokeWidth={2}
            tickStroke="#18181B"
            tickFormat={(v) => `${v}`}
            tickLabelProps={() => ({
              fill: '#18181B',
              fontSize: 10,
              fontWeight: 800,
              textAnchor: 'middle',
              dy: '0.25em',
            })}
          />
        </Group>
      </svg>

      {tooltipOpen && tooltipData && (
        <TooltipWithBounds top={tooltipTop} left={tooltipLeft} style={tooltipStyles}>
          <div className="font-mono text-xs">
            <span className="font-extrabold uppercase">{tooltipData.category}:</span>{' '}
            <span className="font-black text-[#FAFAFA]">{tooltipData.count} record(s)</span>
          </div>
        </TooltipWithBounds>
      )}
    </div>
  );
}

export function ExceptionBarChart(props) {
  return (
    <ParentSize>
      {({ width, height }) => <ExceptionBarChartInner width={width} height={height} {...props} />}
    </ParentSize>
  );
}
