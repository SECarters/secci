import React from 'react';
import { AlertTriangle, Truck } from 'lucide-react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import JobCard from './JobCard';
import { Badge } from '@/components/ui/badge';

export default function TruckJobColumn({ truck, jobs, isOverCapacity, utilizationPercent }) {
  const totalWeight = jobs.reduce((sum, job) => sum + (job.weightKg || 0), 0);

  return (
    <div className="w-72 md:w-80 bg-white rounded-lg border shadow-sm flex-shrink-0">
      {/* Header */}
      <div className="p-3 md:p-4 border-b bg-gray-50 rounded-t-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Truck className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
            <h3 className="text-base md:text-lg font-semibold text-gray-900">{truck.name}</h3>
          </div>
          <Badge variant="secondary" className={`text-xs ${
            isOverCapacity ? 'bg-red-100 text-red-800' : 
            utilizationPercent > 80 ? 'bg-amber-100 text-amber-800' : 
            'bg-blue-100 text-blue-800'
          }`}>
            {jobs.length}
          </Badge>
        </div>
        
        {/* Capacity Info */}
        <div className="text-xs md:text-sm">
          <div className={`flex items-center justify-between mb-1 ${
            isOverCapacity ? 'text-red-600' : utilizationPercent > 80 ? 'text-amber-600' : 'text-gray-600'
          }`}>
            <span>Capacity: {(totalWeight / 1000).toFixed(1)}t / {truck.capacity}t</span>
            {isOverCapacity && <AlertTriangle className="h-3 w-3 md:h-4 md:w-4" />}
          </div>
          
          {/* Utilization Bar */}
          <div className="w-full bg-gray-200 rounded-full h-1.5 md:h-2">
            <div
              className={`h-1.5 md:h-2 rounded-full transition-all ${
                isOverCapacity ? 'bg-red-500' : utilizationPercent > 80 ? 'bg-amber-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Job List */}
      <Droppable droppableId={truck.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`min-h-[300px] md:min-h-[400px] p-3 md:p-4 space-y-3 ${
              snapshot.isDraggingOver ? 'bg-blue-50' : ''
            }`}
          >
            {jobs.length === 0 ? (
              <div className={`flex flex-col items-center justify-center h-24 md:h-32 text-gray-400 border-2 border-dashed rounded-lg ${
                snapshot.isDraggingOver ? 'border-blue-300 text-blue-500' : 'border-gray-200'
              }`}>
                <Truck className="h-6 w-6 md:h-8 md:w-8 mb-2" />
                <span className="text-xs md:text-sm">{snapshot.isDraggingOver ? "Drop here" : "No jobs assigned"}</span>
              </div>
            ) : (
              jobs.map((job, index) => (
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
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}