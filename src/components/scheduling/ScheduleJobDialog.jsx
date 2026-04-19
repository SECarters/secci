import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from "@/components/ui/use-toast";
import { base44 } from '@/api/base44Client';
import { CalendarClock } from 'lucide-react';
import { format } from 'date-fns';

import { TRUCKS, DELIVERY_WINDOWS } from '@/lib/constants';

export default function ScheduleJobDialog({ job, assignment, open, onOpenChange, onScheduled }) {
  const [selectedTruck, setSelectedTruck] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [selectedSlotPosition, setSelectedSlotPosition] = useState(1);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      if (assignment) {
        setSelectedTruck(assignment.truckId || '');
        setSelectedDate(assignment.date || format(new Date(), 'yyyy-MM-dd'));
        setSelectedTimeSlot(assignment.timeSlotId || '');
        setSelectedSlotPosition(assignment.slotPosition || 1);
      } else if (job) {
        setSelectedTruck('');
        setSelectedDate(job.requestedDate || format(new Date(), 'yyyy-MM-dd'));
        setSelectedTimeSlot('');
        setSelectedSlotPosition(1);
      } else {
        setSelectedTruck('');
        setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
        setSelectedTimeSlot('');
        setSelectedSlotPosition(1);
      }
    }
  }, [open, assignment, job]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const formData = {
      truckId: selectedTruck,
      date: selectedDate,
      timeSlotId: selectedTimeSlot,
      slotPosition: selectedSlotPosition
    };

    if (!formData.truckId || !formData.date || !formData.timeSlotId || !formData.slotPosition) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      const user = await base44.auth.me();
      
      if (assignment) {
        await base44.entities.Assignment.update(assignment.id, {
          truckId: formData.truckId,
          timeSlotId: formData.timeSlotId,
          slotPosition: parseInt(formData.slotPosition.toString()) || 1,
          date: formData.date
        });
      } else {
        await base44.entities.Assignment.create({
          jobId: job.id,
          truckId: formData.truckId,
          timeSlotId: formData.timeSlotId,
          slotPosition: parseInt(formData.slotPosition.toString()) || 1,
          date: formData.date
        });
      }

      await base44.entities.Job.update(job.id, { status: 'SCHEDULED' });

      // Log scheduling action
      await base44.entities.JobActivityLog.create({
        jobId: job.id,
        customerId: job.customerId,
        customerName: job.customerName,
        activityType: 'scheduled',
        description: `Job ${assignment ? 'rescheduled' : 'scheduled'} to ${TRUCKS.find(t => t.id === formData.truckId)?.name || formData.truckId} on ${format(new Date(formData.date), 'MMM dd, yyyy')}`,
        userId: user.id,
        userName: user.full_name,
        userRole: user.role === 'admin' ? 'admin' : user.appRole,
        oldValue: assignment ? `${assignment.truckId} - ${assignment.date}` : null,
        newValue: `${formData.truckId} - ${formData.date}`
      });

      try {
        const customers = await base44.entities.Customer.filter({ id: job.customerId });
        if (customers.length > 0) {
          const customer = customers[0];
          if (customer.contactEmail) {
            const truckName = TRUCKS.find(t => t.id === formData.truckId)?.name || formData.truckId;

            await base44.functions.invoke('sendJobScheduledEmail', {
              jobId: job.id,
              customerEmail: customer.contactEmail,
              customerName: customer.customerName,
              truckName: truckName,
              date: formData.date,
              timeSlot: formData.timeSlotId
            });
          }
        }
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
      }

      toast({
        title: assignment ? "Job Rescheduled" : "Job Scheduled",
        description: `Job has been ${assignment ? 'rescheduled' : 'scheduled'} successfully.`,
      });

      onScheduled();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to schedule job. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to schedule job:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnschedule = async () => {
    if (!assignment) return;
    
    setLoading(true);
    try {
      await base44.entities.Assignment.delete(assignment.id);
      await base44.entities.Job.update(job.id, { status: 'APPROVED' });
      toast({
        title: "Job Unscheduled",
        description: "Job has been removed from the schedule and is now available to reschedule.",
      });
      onScheduled();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unschedule job. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to unschedule job:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-indigo-600" />
            {assignment ? 'Reschedule Job' : 'Schedule Job'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Customer:</span> {job?.customerName}
              </p>
              <p className="text-sm text-gray-700 mt-1">
                <span className="font-semibold">Delivery:</span> {job?.deliveryLocation}
              </p>
            </div>

            <div>
              <Label htmlFor="truck">Truck *</Label>
              <Select value={selectedTruck} onValueChange={setSelectedTruck} required>
                <SelectTrigger id="truck">
                  <SelectValue placeholder="Select truck..." />
                </SelectTrigger>
                <SelectContent>
                  {TRUCKS.map(truck => (
                    <SelectItem key={truck.id} value={truck.id}>{truck.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="timeSlot">Time Slot *</Label>
              <Select value={selectedTimeSlot} onValueChange={setSelectedTimeSlot} required>
                <SelectTrigger id="timeSlot">
                  <SelectValue placeholder="Select time slot..." />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_WINDOWS.map(window => (
                    <SelectItem key={window.id} value={window.id}>{window.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="slotPosition">Delivery Slot *</Label>
              <Select value={selectedSlotPosition.toString()} onValueChange={(val) => setSelectedSlotPosition(parseInt(val))} required>
                <SelectTrigger id="slotPosition">
                  <SelectValue placeholder="Select slot..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Slot 1 (Top)</SelectItem>
                  <SelectItem value="2">Slot 2 (Middle)</SelectItem>
                  <SelectItem value="3">Slot 3 (Bottom)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <div>
              {assignment && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={handleUnschedule}
                  disabled={loading}
                >
                  Unschedule
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : assignment ? 'Reschedule' : 'Schedule'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}