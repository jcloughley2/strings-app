"use client";
import React, { useRef, useState } from 'react';

interface NavigationNode {
  id: string;
  name: string;
  hash: string;
  type: 'string' | 'conditional';
  isActive: boolean;
  relationship?: 'spawn' | 'embedded' | 'parent-embeds' | 'parent-spawns';
}

interface DrawerNavigationProps {
  nodes: NavigationNode[];
  onNodeClick: (nodeId: string) => void;
}

interface NavigationNodeItemProps {
  node: NavigationNode;
  index: number;
  onNodeClick: (nodeId: string) => void;
}

function NavigationNodeItem({ node, index, onNodeClick }: NavigationNodeItemProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [tooltipTop, setTooltipTop] = useState(0);
  const [tooltipLeft, setTooltipLeft] = useState(0);

  const handleMouseEnter = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setTooltipTop(rect.top + rect.height / 2);
      setTooltipLeft(rect.right + 8); // 8px gap from the right edge of the button
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

  // Determine if this is a parent or child
  const isParent = node.relationship?.startsWith('parent-');
  const isChild = node.relationship === 'spawn' || node.relationship === 'embedded';
  
  // Size: active = 48px, parent/child = 36px
  const size = node.isActive ? 48 : 36;
  const fontSize = node.isActive ? 16 : 12;
  const borderWidth = node.isActive ? 3 : 2;

  return (
    <div
      key={node.id}
      className="relative w-full"
      style={{
        // Align parents to left, children to right, active centered
        display: 'flex',
        justifyContent: isParent ? 'flex-start' : isChild ? 'flex-end' : 'center',
      }}
    >
      <button
        ref={buttonRef}
        onClick={() => onNodeClick(node.id)}
        onMouseEnter={handleMouseEnter}
        className="relative group"
        title={`${node.name || node.hash}${node.relationship ? ` (${node.relationship})` : ''}`}
      >
        {/* Connecting line for children */}
        {index > 0 && (
          <div 
            className="absolute w-0.5 bg-border"
            style={{
              height: '12px',
              top: '-12px',
              left: isParent ? `${size / 2}px` : isChild ? `calc(100% - ${size / 2}px)` : '50%',
            }}
          />
        )}
        
        {/* Node square */}
        <div
          className="rounded-lg flex items-center justify-center transition-all cursor-pointer"
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
    </div>
  );
}

export function DrawerNavigation({ nodes, onNodeClick }: DrawerNavigationProps) {
  if (nodes.length === 0) return null;

  return (
    <div className="w-24 border-r bg-muted/30 flex flex-col py-4 px-3 gap-3 overflow-y-auto min-h-full max-h-full relative">
      {nodes.map((node, index) => (
        <NavigationNodeItem 
          key={node.id}
          node={node}
          index={index}
          onNodeClick={onNodeClick}
        />
      ))}
    </div>
  );
}

