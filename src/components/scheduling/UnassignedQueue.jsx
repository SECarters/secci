import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, Package } from 'lucide-react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import JobCard from './JobCard';

export default function UnassignedQueue({ jobs }) {
  const sortedJobs = [...jobs].sort((a, b) => 
    new Date(a.requestedDate) - new Date(b.requestedDate)
  );

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 md:p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Package className="h-4 w-4 md:h-5 md:w-5 text-gray-600" />
            <h2 className="text-base md:text-lg font-semibold">Unassigned Jobs</h2>
          </div>
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 text-xs">
            {jobs.length}
          </Badge>
        </div>
        <p className="text-xs md:text-sm text-gray-600 mt-1">
          Drag jobs to schedule them
        </p>
      </div>

      <Droppable droppableId="unassigned">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 overflow-y-auto p-3 md:p-4 space-y-3 ${
              snapshot.isDraggingOver ? 'bg-blue-50' : ''
            }`}
          >
            {sortedJobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-8 w-8 md:h-12 md:w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-xs md:text-sm">All jobs are scheduled!</p>
              </div>
            ) : (
              sortedJobs.map((job, index) => (
                <Draggable key={job.id} draggableId={job.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      <div className="relative">
                        <JobCard job={job} isDragging={snapshot.isDragging} />
                        <div className="mt-1 flex items-center text-xs text-gray-500">
                          <Clock className="h-3 w-3 mr-1" />
                          <span>Requested: {new Date(job.requestedDate).toLocaleDateString()}</span>
                        </div>
                      </div>
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