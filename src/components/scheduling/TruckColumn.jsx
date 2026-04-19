import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import JobCard from './JobCard';

export default function TruckColumn({ 
  truckId, 
  timeSlotId, 
  jobs, 
  isOverCapacity, 
  utilizationPercent,
  capacity 
}) {
  const totalWeight = jobs.reduce((sum, job) => sum + (job.weightKg || 0), 0);
  const droppableId = `${truckId}-${timeSlotId}`;

  return (
    <Droppable droppableId={droppableId}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`min-h-[120px] rounded-lg border-2 border-dashed transition-all p-2 space-y-2 ${
            snapshot.isDraggingOver ? 'border-blue-400 bg-blue-50' : 
            isOverCapacity ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-gray-50'
          }`}
        >
          {/* Capacity indicator */}
          <div className="flex items-center justify-between text-xs mb-2">
            <div className={`font-medium ${
              isOverCapacity ? 'text-red-600' : utilizationPercent > 80 ? 'text-amber-600' : 'text-gray-600'
            }`}>
              {(totalWeight / 1000).toFixed(1)}t / {capacity}t
            </div>
            {isOverCapacity && (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
          </div>

          {/* Utilization bar */}
          <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
            <div
              className={`h-1.5 rounded-full transition-all ${
                isOverCapacity ? 'bg-red-500' : utilizationPercent > 80 ? 'bg-amber-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
            />
          </div>

          {/* Jobs in this slot */}
          {jobs.map((job, index) => (
            <Draggable key={job.id} draggableId={job.id} index={index}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.draggableProps}
                  {...provided.dragHandleProps}
                >
                  <JobCard job={job} isDragging={snapshot.isDragging} />
                </div>
              )}
            </Draggable>
          ))}

          {/* Empty state */}
          {jobs.length === 0 && (
            <div className={`flex items-center justify-center h-16 text-xs text-gray-400 border border-dashed rounded ${
              snapshot.isDraggingOver ? 'border-blue-300 text-blue-500' : ''
            }`}>
              {snapshot.isDraggingOver ? "Drop here" : "Empty"}
            </div>
          )}
          
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}