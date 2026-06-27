import React, { useState, useEffect } from "react";

export interface ShelvingInteractiveProps {
  items: string[];
  originalItems: string[];
  onConfirm: (isCorrect: boolean, arranged: string[]) => void;
  showCorrectAnswerOnFail?: boolean;
  onRetry?: () => void;
  disableRetry?: boolean;
}

export const ShelvingInteractive: React.FC<ShelvingInteractiveProps> = ({
  items,
  originalItems,
  onConfirm,
  showCorrectAnswerOnFail = false,
  onRetry,
  disableRetry = false,
}) => {
  const [tray, setTray] = useState<string[]>([]);
  const [canvas, setCanvas] = useState<string[]>([]);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [userSubmission, setUserSubmission] = useState<string[] | null>(null);

  useEffect(() => {
    setTray([...items]);
    setCanvas([]);
    setHasSubmitted(false);
    setIsCorrect(null);
    setUserSubmission(null);
  }, [items]);

  const handleReset = () => {
    setTray([...items]);
    setCanvas([]);
    setHasSubmitted(false);
    setIsCorrect(null);
    setUserSubmission(null);
  };

  const handleTrayItemClick = (item: string) => {
    if (hasSubmitted) return;
    setTray((prev) => prev.filter((i) => i !== item));
    setCanvas((prev) => [...prev, item]);
  };

  const handleCanvasItemClick = (item: string) => {
    if (hasSubmitted) return;
    setCanvas((prev) => prev.filter((i) => i !== item));
    setTray((prev) => [...prev, item]);
  };

  const handleDragStart = (e: React.DragEvent, item: string) => {
    if (hasSubmitted) return;
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => {
      if (e.target) (e.target as HTMLElement).style.opacity = "0.4";
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedItem(null);
    setDragOverIndex(null);
    if (e.target) (e.target as HTMLElement).style.opacity = "1";
  };

  const handleDragOverCanvas = (e: React.DragEvent) => {
    e.preventDefault();
    if (hasSubmitted || !draggedItem) return;
    e.dataTransfer.dropEffect = "move";

    // Calculate precise drop index based on mouse position within the canvas
    const rect = e.currentTarget.getBoundingClientRect();
    const children = Array.from(e.currentTarget.children).filter(
      (child) => child.getAttribute("data-draggable") === "true",
    );

    let foundIndex = children.length;
    for (let i = 0; i < children.length; i++) {
      const childRect = children[i].getBoundingClientRect();
      // Compare vertical center of child to cursor
      if (e.clientY < childRect.top + childRect.height / 2) {
        foundIndex = i;
        break;
      }
    }
    setDragOverIndex(foundIndex);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (hasSubmitted || !draggedItem) return;

    const dropIndex = dragOverIndex !== null ? dragOverIndex : canvas.length;

    if (tray.includes(draggedItem)) {
      setTray((prev) => prev.filter((i) => i !== draggedItem));
      setCanvas((prev) => {
        const newCanvas = [...prev];
        newCanvas.splice(dropIndex, 0, draggedItem);
        return newCanvas;
      });
    } else if (canvas.includes(draggedItem)) {
      setCanvas((prev) => {
        const draggedIndex = prev.indexOf(draggedItem);

        let finalDropIndex = dropIndex;
        if (draggedIndex < dropIndex) {
          finalDropIndex -= 1;
        }

        if (draggedIndex === finalDropIndex) return prev;

        const newCanvas = [...prev];
        newCanvas.splice(draggedIndex, 1);
        newCanvas.splice(finalDropIndex, 0, draggedItem);
        return newCanvas;
      });
    }

    setDraggedItem(null);
    setDragOverIndex(null);
  };

  const handleConfirm = () => {
    if (canvas.length !== items.length) return;

    const correct = canvas.every(
      (item, index) => item === originalItems[index],
    );
    setIsCorrect(correct);
    setHasSubmitted(true);
    setUserSubmission([...canvas]);

    if (!correct && showCorrectAnswerOnFail) {
      setTimeout(() => {
        setCanvas([...originalItems]);
      }, 1000);
    }

    onConfirm(correct, canvas);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        width: "100%",
      }}
    >
      {/* Canvas */}
      <div
        style={{
          minHeight: "180px",
          background: "var(--cream)",
          border: "2px dashed var(--cream-border)",
          borderRadius: "var(--radius)",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          position: "relative",
          transition: "all 0.2s",
        }}
        onDragOver={handleDragOverCanvas}
        onDrop={handleDrop}
      >
        {canvas.length === 0 && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              color: "var(--ink-faint)",
              fontSize: "calc(14px * var(--scale, 1))",
              pointerEvents: "none",
            }}
          >
            Click or drag items here
          </div>
        )}

        {canvas.map((item, idx) => {
          const isDraggingThis = draggedItem === item;
          return (
            <React.Fragment key={item}>
              {dragOverIndex === idx && !isDraggingThis && (
                <div
                  style={{
                    height: "48px",
                    background: "rgba(0,0,0,0.03)",
                    borderRadius: "var(--radius)",
                    border: "2px dashed var(--ink-muted)",
                    margin: "4px 0",
                  }}
                />
              )}
              <div
                data-draggable="true"
                draggable={!hasSubmitted}
                onDragStart={(e) => handleDragStart(e, item)}
                onDragEnd={handleDragEnd}
                onClick={() => handleCanvasItemClick(item)}
                style={{
                  padding: "14px 16px",
                  background:
                    hasSubmitted &&
                    userSubmission &&
                    userSubmission.indexOf(item) === originalItems.indexOf(item)
                      ? "var(--green-bg)"
                      : hasSubmitted &&
                          userSubmission &&
                          userSubmission.indexOf(item) !==
                            originalItems.indexOf(item) &&
                          showCorrectAnswerOnFail
                        ? "var(--red-bg)"
                        : "var(--cream)",
                  border:
                    hasSubmitted &&
                    userSubmission &&
                    userSubmission.indexOf(item) === originalItems.indexOf(item)
                      ? "1px solid var(--green)"
                      : hasSubmitted &&
                          userSubmission &&
                          userSubmission.indexOf(item) !==
                            originalItems.indexOf(item) &&
                          showCorrectAnswerOnFail
                        ? "1px solid var(--red)"
                        : "1px solid var(--cream-border)",
                  borderRadius: "var(--radius)",
                  color:
                    hasSubmitted &&
                    userSubmission &&
                    userSubmission.indexOf(item) === originalItems.indexOf(item)
                      ? "var(--green)"
                      : hasSubmitted &&
                          userSubmission &&
                          userSubmission.indexOf(item) !==
                            originalItems.indexOf(item) &&
                          showCorrectAnswerOnFail
                        ? "var(--red)"
                        : "var(--ink)",
                  fontSize: "calc(16px * var(--scale, 1))",
                  fontFamily: "var(--font-body)",
                  cursor: hasSubmitted ? "default" : "pointer",
                  opacity: isDraggingThis ? 0 : 1,
                  boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                  transition: "all 0.15s ease",
                  userSelect: "none",
                }}
              >
                {item}
              </div>
            </React.Fragment>
          );
        })}
        {dragOverIndex === canvas.length && draggedItem && (
          <div
            style={{
              height: "48px",
              background: "rgba(0,0,0,0.03)",
              borderRadius: "var(--radius)",
              border: "2px dashed var(--ink-muted)",
              margin: "4px 0",
            }}
          />
        )}
      </div>

      {/* Tray */}
      <div
        style={{
          minHeight: "100px",
          background: "var(--cream-dark)",
          borderRadius: "var(--radius)",
          padding: "16px",
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignContent: "flex-start",
        }}
      >
        {tray.map((item) => (
          <div
            key={item}
            draggable={!hasSubmitted}
            onDragStart={(e) => handleDragStart(e, item)}
            onDragEnd={handleDragEnd}
            onClick={() => handleTrayItemClick(item)}
            style={{
              padding: "12px 16px",
              background: "var(--cream)",
              border: "1px solid var(--cream-border)",
              borderRadius: "var(--radius)",
              color: "var(--ink)",
              fontSize: "calc(15px * var(--scale, 1))",
              fontFamily: "var(--font-body)",
              cursor: hasSubmitted ? "default" : "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              userSelect: "none",
            }}
          >
            {item}
          </div>
        ))}
      </div>

      {/* Confirm Button */}
      {hasSubmitted ? (
        <div style={{ display: "flex", gap: "12px" }}>
          {!disableRetry && (
            <button
              onClick={handleReset}
              style={{
                flex: 1,
                padding: "10px 0",
                fontSize: "calc(16px * var(--scale, 1))",
                fontWeight: 500,
                background: "var(--accent-bg)",
                color: "var(--accent)",
                border: "1px solid var(--accent-light)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              Try Again
            </button>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                flex: 1,
                padding: "10px 0",
                fontSize: "calc(16px * var(--scale, 1))",
                fontWeight: 500,
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              New Practice
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={handleConfirm}
          disabled={canvas.length !== items.length}
          style={{
            padding: "16px",
            background:
              canvas.length === items.length
                ? "var(--accent)"
                : "var(--cream-border)",
            color:
              canvas.length === items.length
                ? "var(--cream)"
                : "var(--ink-faint)",
            border: "none",
            borderRadius: "var(--radius)",
            fontSize: "calc(16px * var(--scale, 1))",
            fontWeight: 500,
            fontFamily: "var(--font-body)",
            cursor: canvas.length === items.length ? "pointer" : "default",
            transition: "all 0.2s",
          }}
        >
          Confirm
        </button>
      )}
    </div>
  );
};
