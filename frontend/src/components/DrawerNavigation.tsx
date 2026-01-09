"use client";
import React, { useRef, useState } from 'react';

interface NavigationNode {
  id: string;
  name: string;
  hash: string;
  type: 'string' | 'conditional';
  isActive: boolean;
  relationship?: 'spawn' | 'embedded' | 'parent-embeds' | 'parent-spawns';
  isDirty?: boolean; // Has unsaved changes
}

interface DrawerNavigationProps {
  nodes: NavigationNode[];
  onNodeClick: (nodeId: string) => void;
  dirtyVariableIds?: Set<string>; // IDs of variables with unsaved changes
}

interface NodeSquareProps {
  node: NavigationNode;
  onNodeClick: (nodeId: string) => void;
}

function NodeSquare({ node, onNodeClick }: NodeSquareProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [tooltipTop, setTooltipTop] = useState(0);
  const [tooltipLeft, setTooltipLeft] = useState(0);

  const handleMouseEnter = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTooltipTop(rect.top + rect.height / 2);
      setTooltipLeft(rect.right + 8);
    }
  };

  const bgColor = node.type === 'conditional' 
    ? 'var(--conditional-var-100)' 
    : 'var(--string-var-100)';
  const borderColor = node.type === 'conditional'
    ? 'var(--conditional-var-color)'
    : 'var(--string-var-color)';
  const activeBg = node.type === 'conditional'
    ? 'var(--conditional-var-200)'
    : 'var(--string-var-200)';

  const isChild = node.relationship === 'spawn' || node.relationship === 'embedded';
  
  // Size: active = 48px, parent/child = 36px
  const size = node.isActive ? 48 : 36;
  const fontSize = node.isActive ? 16 : 12;
  const borderWidth = 1; // Always 1px stroke for all tiles

  return (
    <button
      ref={buttonRef}
      onClick={() => onNodeClick(node.id)}
      onMouseEnter={handleMouseEnter}
      className="relative group flex-shrink-0"
      title={`${node.name || node.hash}${node.relationship ? ` (${node.relationship})` : ''}`}
    >
      {/* Node square */}
      <div
        className="rounded-lg flex items-center justify-center transition-all cursor-pointer relative"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: node.isActive ? activeBg : bgColor,
          borderColor: borderColor,
          borderWidth: `${borderWidth}px`,
          borderStyle: 'solid',
          boxShadow: node.isActive 
            ? '0 4px 12px rgba(0,0,0,0.15)' 
            : '0 2px 6px rgba(0,0,0,0.08)',
        }}
      >
        {/* Display first letter of name or hash */}
        <span 
          className="font-semibold"
          style={{ 
            color: node.type === 'conditional' 
              ? 'var(--conditional-var-700)' 
              : 'var(--string-var-700)',
            fontSize: `${fontSize}px`,
          }}
        >
          {(node.name || node.hash).charAt(0).toUpperCase()}
        </span>

        {/* Dirty indicator dot */}
        {node.isDirty && (
          <div 
            className="absolute top-0 right-0 w-2 h-2 rounded-full bg-blue-500 border border-white"
            title="Unsaved changes"
          />
        )}
      </div>

      {/* Hover tooltip */}
      <div 
        className="fixed opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ 
          zIndex: 9999,
          left: `${tooltipLeft}px`,
          top: `${tooltipTop}px`,
          transform: 'translateY(-50%)',
        }}
      >
        <div className="bg-popover text-popover-foreground px-3 py-2 rounded-md shadow-lg border text-xs whitespace-nowrap">
          <div className="font-semibold">{node.name || node.hash}</div>
          {node.relationship && (
            <div className="text-muted-foreground capitalize mt-1">
              {node.relationship.replace('parent-', 'parent: ')}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export function DrawerNavigation({ nodes, onNodeClick, dirtyVariableIds }: DrawerNavigationProps) {
  if (nodes.length === 0) return null;

  // Mark nodes as dirty if they're in the dirty set
  const nodesWithDirtyState = nodes.map(node => ({
    ...node,
    isDirty: dirtyVariableIds?.has(node.id) || false,
  }));
  
  // Separate nodes into parents, active, and children
  const parentNodes = nodesWithDirtyState.filter(node => node.relationship?.startsWith('parent-'));
  const activeNode = nodesWithDirtyState.find(node => node.isActive);
  const childNodes = nodesWithDirtyState.filter(node => 
    node.relationship === 'spawn' || node.relationship === 'embedded'
  );

  const gapSize = 12; // gap-3 in pixels
  const childSize = 36;
  const activeSize = 48;
  const parentSize = 36;
  const paddingX = 16; // 16px left and right padding
  const lineGap = 8; // Gap between tiles and the vertical line

  // Calculate content width to accommodate full parent + active + child layout:
  // Left of vertical line: parent (36px) + gap (8px) = 44px
  // Right of vertical line: gap (8px) + child (36px) = 44px
  // Content width = 88px, plus 16px padding on each side = 120px total
  const contentWidth = parentSize + lineGap + lineGap + childSize; // 88px
  const totalWidth = contentWidth + paddingX * 2; // 120px
  const activeCenterX = contentWidth / 2; // 44px - center of content area (where vertical line goes)
  
  return (
    <div 
      className="border-r bg-muted/30 flex flex-col py-4 gap-3 overflow-y-auto min-h-full max-h-full relative"
      style={{ width: `${totalWidth}px`, paddingLeft: `${paddingX}px`, paddingRight: `${paddingX}px` }}
    >
      {/* Parents section - with branching tree structure going upward */}
      {parentNodes.length > 0 && (() => {
        const verticalLineX = activeCenterX; // Vertical line at center (will connect to active's top)
        // Parent tiles are on the LEFT side, their right edge is 8px away from vertical line
        const parentRightEdgeX = verticalLineX - 8; // Right edge of parent tiles
        const parentLeftEdgeX = parentRightEdgeX - parentSize; // Left edge = right edge - tile width
        
        // Calculate total height of parents section
        const totalParentsHeight = parentNodes.length * parentSize + (parentNodes.length - 1) * gapSize;
        
        return (
          <div className="relative">
            {/* Vertical branch line extending down to connect to active node's top */}
            <svg
              className="absolute pointer-events-none"
              style={{
                left: '0px',
                top: '0px',
                width: `${contentWidth}px`,
                height: `${totalParentsHeight}px`,
                overflow: 'visible',
              }}
            >
              {/* Main vertical line - from first parent center down to below last parent (into gap toward active) */}
              <line
                x1={verticalLineX}
                y1={parentSize / 2} // Start at first parent's vertical center
                x2={verticalLineX}
                y2={totalParentsHeight + gapSize} // Extend down into the gap to connect to active
                stroke="#d1d5db"
                strokeWidth="2"
              />
              
              {/* Horizontal connectors for each parent - from right edge of parent tile to vertical line */}
              {parentNodes.map((_, index) => {
                const parentCenterY = index * (parentSize + gapSize) + parentSize / 2;
                return (
                  <line
                    key={index}
                    x1={parentRightEdgeX} // Start at right edge of parent tile
                    y1={parentCenterY}
                    x2={verticalLineX} // End at vertical line
                    y2={parentCenterY}
                    stroke="#d1d5db"
                    strokeWidth="2"
                  />
                );
              })}
            </svg>

            {/* Parent nodes - positioned to left of vertical line */}
            <div className="flex flex-col gap-3">
              {parentNodes.map((node) => (
                <div key={node.id} className="relative" style={{ marginLeft: `${parentLeftEdgeX}px`, width: `${parentSize}px` }}>
                  <NodeSquare node={node} onNodeClick={onNodeClick} />
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Active node - centered */}
      {activeNode && (
        <div className="relative w-full flex justify-center">
          <NodeSquare node={activeNode} onNodeClick={onNodeClick} />
        </div>
      )}

      {/* Children section - with branching tree structure */}
      {childNodes.length > 0 && (() => {
        // Use the shared activeCenterX for vertical line position
        const verticalLineX = activeCenterX; // Where vertical line is drawn
        const childLeftMargin = verticalLineX + lineGap; // Children start 8px to right of vertical line
        const horizontalLineEndX = childLeftMargin; // Horizontal lines extend to meet child left edge
        
        // Calculate total height of children section
        // Each child is childSize (36px) tall, with gapSize (12px) gap between them
        const totalChildrenHeight = childNodes.length * childSize + (childNodes.length - 1) * gapSize;
        
        return (
          <div className="relative">
            {/* Vertical branch line extending from center bottom of active node */}
            <svg
              className="absolute pointer-events-none"
              style={{
                left: '0px',
                top: '0px', // SVG starts at top of children container
                width: `${contentWidth}px`,
                height: `${totalChildrenHeight}px`,
                overflow: 'visible',
              }}
            >
              {/* Main vertical line - from top (connecting to gap above) down to last child center */}
              <line
                x1={verticalLineX}
                y1={-gapSize} // Extend up into the gap to connect to active
                x2={verticalLineX}
                y2={(childNodes.length - 1) * (childSize + gapSize) + childSize / 2}
                stroke="#d1d5db"
                strokeWidth="2"
              />
              
              {/* Horizontal connectors for each child - extend to left edge of child tile */}
              {childNodes.map((_, index) => {
                // Each child's vertical center: 
                // First child (index 0): childSize/2 = 18px from top
                // Second child (index 1): childSize + gapSize + childSize/2 = 36 + 12 + 18 = 66px
                const childCenterY = index * (childSize + gapSize) + childSize / 2;
                return (
                  <line
                    key={index}
                    x1={verticalLineX}
                    y1={childCenterY}
                    x2={horizontalLineEndX}
                    y2={childCenterY}
                    stroke="#d1d5db"
                    strokeWidth="2"
                  />
                );
              })}
            </svg>

            {/* Child nodes - positioned to right of branch lines */}
            <div className="flex flex-col gap-3" style={{ marginLeft: `${childLeftMargin}px` }}>
              {childNodes.map((node) => (
                <div key={node.id} className="relative">
                  <NodeSquare node={node} onNodeClick={onNodeClick} />
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
