import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from "@/components/ui/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';

import { Upload, Loader2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const DELIVERY_WINDOWS = [
  { id: 'first-am', label: '6-8am (1st AM)' },
  { id: 'second-am', label: '8-10am (2nd AM)' },
  { id: 'lunch', label: '10am-12pm (LUNCH)' },
  { id: 'first-pm', label: '12-2pm (1st PM)' },
  { id: 'second-pm', label: '2-4pm (2nd PM)' }
];

const TRUCKS = [
  { id: 'ACCO1', name: 'ACCO1' },
  { id: 'ACCO2', name: 'ACCO2' },
  { id: 'FUSO', name: 'FUSO' },
  { id: 'ISUZU', name: 'ISUZU' },
  { id: 'UD', name: 'UD' }
];

const SLOT_POSITIONS = [
  { value: 1, label: 'Slot 1 (Top)' },
  { value: 2, label: 'Slot 2 (Middle)' },
  { value: 3, label: 'Slot 3 (Bottom)' }
];

export default function EditJobDialog({ job, open, onOpenChange, onJobUpdated }) {
  const [customers, setCustomers] = useState([]);
  const [deliveryTypes, setDeliveryTypes] = useState([]);
  const [pickupLocations, setPickupLocations] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    customerId: '',
    deliveryTypeId: '',
    pickupLocationId: '',
    deliveryLocation: '',
    deliveryLatitude: null,
    deliveryLongitude: null,
    requestedDate: '',
    totalUnits: '',
    poSalesDocketNumber: '',
    deliveryWindow: '',
    sqm: '',
    weightKg: '',
    siteContactName: '',
    siteContactPhone: '',
    deliveryNotes: '',
    nonStandardDelivery: {
      longWalk: false,
      longWalkDistance: '',
      passUp: false,
      passDown: false,
      stairs: false,
      stairsCount: '',
      fourManNeeded: false,
      moreThan2000Sqm: false,
      zoneC: false,
      other: false,
      otherDetails: ''
    }
  });
  const [manualSchedule, setManualSchedule] = useState({
    enabled: false,
    truckId: '',
    timeSlotId: '',
    slotPosition: 1
  });
  const [docketNumbers, setDocketNumbers] = useState([]);
  const [docketNotes, setDocketNotes] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const { toast } = useToast();

  // Load customers, delivery types, pickup locations, user, and assignments
  useEffect(() => {
    if (open) {
      const fetchData = async () => {
        const [customersData, typesData, locationsData, user, assignmentsData] = await Promise.all([
          base44.entities.Customer.filter({ status: 'ACTIVE' }),
          base44.entities.DeliveryType.list(),
          base44.entities.PickupLocation.filter({ status: 'ACTIVE' }),
          base44.auth.me(),
          job ? base44.entities.Assignment.filter({ jobId: job.id }) : Promise.resolve([])
        ]);
        setCustomers(customersData);
        setDeliveryTypes(typesData);
        setPickupLocations(locationsData);
        setCurrentUser(user);
        setAssignments(assignmentsData);
        setDataLoaded(true);
      };
      fetchData();
    }
  }, [open, job]);

  // Populate form when job changes and data is loaded
  useEffect(() => {
    if (job && dataLoaded && open) {
      // Parse docket numbers if it's a unit delivery
      const selectedType = deliveryTypes.find(t => t.id === job.deliveryTypeId);
      const isUnitDelivery = selectedType?.name?.toLowerCase().includes('unit');
      
      let parsedDocketNumbers = [];
      let parsedDocketNotes = [];
      
      if (isUnitDelivery && job.poSalesDocketNumber) {
        const dockets = job.poSalesDocketNumber.split(',').map(d => d.trim());
        parsedDocketNumbers = dockets.map(d => {
          const match = d.match(/^(.+?)\s*\((.+)\)$/);
          if (match) {
            return match[1].trim();
          }
          return d;
        });
        parsedDocketNotes = dockets.map(d => {
          const match = d.match(/^(.+?)\s*\((.+)\)$/);
          if (match) {
            return match[2].trim();
          }
          return '';
        });
      }
      
      setFormData({
        customerId: job.customerId || '',
        deliveryTypeId: job.deliveryTypeId || '',
        pickupLocationId: job.pickupLocationId || '',
        deliveryLocation: job.deliveryLocation || '',
        deliveryLatitude: job.deliveryLatitude || null, // Populate new field
        deliveryLongitude: job.deliveryLongitude || null, // Populate new field
        requestedDate: job.requestedDate || '',
        totalUnits: job.totalUnits ? String(job.totalUnits) : '',
        poSalesDocketNumber: !isUnitDelivery ? (job.poSalesDocketNumber || '') : '',
        deliveryWindow: job.deliveryWindow || '',
        sqm: job.sqm ? String(job.sqm) : '',
        weightKg: job.weightKg ? String(job.weightKg) : '',
        siteContactName: job.siteContactName || '',
        siteContactPhone: job.siteContactPhone || '',
        deliveryNotes: job.deliveryNotes || '',
        nonStandardDelivery: job.nonStandardDelivery || {
          longWalk: false,
          longWalkDistance: '',
          passUp: false,
          passDown: false,
          stairs: false,
          stairsCount: '',
          fourManNeeded: false,
          moreThan2000Sqm: false,
          zoneC: false,
          other: false,
          otherDetails: ''
        }
      });
      
      setDocketNumbers(parsedDocketNumbers);
      setDocketNotes(parsedDocketNotes);
      setAttachments(job.attachments || []);
      
      // Load existing assignment for manual schedule
      const existingAssignment = assignments[0];
      if (existingAssignment) {
        setManualSchedule({
          enabled: true,
          truckId: existingAssignment.truckId || '',
          timeSlotId: existingAssignment.timeSlotId || '',
          slotPosition: existingAssignment.slotPosition || 1
        });
      } else {
        setManualSchedule({
          enabled: false,
          truckId: '',
          timeSlotId: '',
          slotPosition: 1
        });
      }
    }
  }, [job, dataLoaded, open, deliveryTypes, assignments]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => {
      const updated = { ...prev, [name]: newValue };
      
      if (name === 'sqm') {
        const sqmValue = parseFloat(newValue);
        const currentNonStandard = { ...prev.nonStandardDelivery };

        if (!isNaN(sqmValue) && sqmValue >= 2000) {
          currentNonStandard.moreThan2000Sqm = true;
          currentNonStandard.fourManNeeded = true;
        } else if (isNaN(sqmValue) || sqmValue < 2000) {
          currentNonStandard.moreThan2000Sqm = false;
          currentNonStandard.fourManNeeded = false;
        }
        updated.nonStandardDelivery = currentNonStandard;
      }
      
      if (name === 'totalUnits') {
        const numUnits = parseInt(value) || 0;
        if (numUnits > 0 && numUnits <= 20) {
          const currentDockets = docketNumbers.slice(0, numUnits);
          const currentNotes = docketNotes.slice(0, numUnits);

          setDocketNumbers([...currentDockets, ...Array(Math.max(0, numUnits - currentDockets.length)).fill('')]);
          setDocketNotes([...currentNotes, ...Array(Math.max(0, numNotes.length)).fill('')]);
        } else {
          setDocketNumbers([]);
          setDocketNotes([]);
        }
      }
      
      return updated;
    });
  };



  const handleNonStandardChange = (field, value) => {
    setFormData(prev => {
      const updatedNonStandardDelivery = { ...prev.nonStandardDelivery, [field]: value };

      if (field === 'longWalk' && !value) {
        updatedNonStandardDelivery.longWalkDistance = '';
      }
      if (field === 'stairs' && !value) {
        updatedNonStandardDelivery.stairsCount = '';
      }
      if (field === 'other' && !value) {
        updatedNonStandardDelivery.otherDetails = '';
      }
      if (field === 'moreThan2000Sqm' && value) {
        updatedNonStandardDelivery.fourManNeeded = true;
      }
      
      return {
        ...prev,
        nonStandardDelivery: updatedNonStandardDelivery
      };
    });
  };

  const handleDocketNumberChange = (index, value) => {
    const updated = [...docketNumbers];
    updated[index] = value;
    setDocketNumbers(updated);
  };

  const handleDocketNoteChange = (index, value) => {
    const updated = [...docketNotes];
    updated[index] = value;
    setDocketNotes(updated);
  };

  const handleSelectChange = (name, value) => {
    if (name === 'deliveryTypeId') {
      const selectedType = deliveryTypes.find(dt => dt.id === value);
      const manitouCodes = ['UPDWN', 'UNITUP', 'MANS'];
      const requiresManitou = selectedType ? manitouCodes.includes(selectedType.code) : false;
      setFormData(prev => ({ ...prev, deliveryTypeId: value, requiresManitou }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAttachmentUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingAttachment(true);
    try {
      const uploadPromises = files.map(file => base44.integrations.Core.UploadFile({ file }));
      const results = await Promise.all(uploadPromises);
      const fileUrls = results.map(r => r.file_url);
      
      setAttachments(prev => [...prev, ...fileUrls]);
      
      toast({
        title: "Files Uploaded",
        description: `${files.length} file(s) uploaded successfully.`,
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload files. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to upload attachments:", error);
    } finally {
      e.target.value = '';
      setUploadingAttachment(false);
    }
  };

  const handleRemoveAttachment = (indexToRemove) => {
    setAttachments(prev => prev.filter((_, index) => index !== indexToRemove));
  };



  const selectedDeliveryType = deliveryTypes.find(t => t.id === formData.deliveryTypeId);
  const isUnitsDelivery = selectedDeliveryType?.name?.toLowerCase().includes('unit');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setLoading(true);
    try {
      if (!formData.customerId || !formData.deliveryTypeId || !formData.pickupLocationId) {
        throw new Error("Please fill in all required fields: Customer, Delivery Type, and Pickup Location.");
      }

      // Validate manual schedule if enabled
      if (manualSchedule.enabled) {
        if (!manualSchedule.truckId || !manualSchedule.timeSlotId || !formData.requestedDate) {
          throw new Error("Please complete manual scheduling by selecting truck, time slot, and date.");
        }
      }

      const selectedCustomer = customers.find(c => c.id === formData.customerId);
      const selectedType = deliveryTypes.find(t => t.id === formData.deliveryTypeId);
      const selectedLocation = pickupLocations.find(l => l.id === formData.pickupLocationId);
      
      if (!selectedCustomer || !selectedType || !selectedLocation) {
        throw new Error("Invalid selection for customer, delivery type, or pickup location.");
      }

      const docketInfo = isUnitsDelivery && docketNumbers.length > 0
        ? docketNumbers.map((num, idx) => {
            const note = docketNotes[idx]?.trim();
            return note ? `${num} (${note})` : num;
          }).filter(d => d.trim()).join(', ')
        : formData.poSalesDocketNumber;

      const hasNonStandard = Object.entries(formData.nonStandardDelivery).some(([key, value]) => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') return value.trim() !== '';
        return false;
      });

      // Determine if this is a difficult delivery
      const isDifficult = formData.nonStandardDelivery.longWalk || 
                         formData.nonStandardDelivery.passUp || 
                         formData.nonStandardDelivery.passDown || 
                         formData.nonStandardDelivery.stairs || 
                         formData.nonStandardDelivery.fourManNeeded || 
                         formData.nonStandardDelivery.moreThan2000Sqm || 
                         formData.nonStandardDelivery.zoneC || 
                         formData.nonStandardDelivery.other;

      // Determine job status based on manual scheduling
      let newStatus = job.status;
      if (manualSchedule.enabled && manualSchedule.truckId && manualSchedule.timeSlotId) {
        newStatus = 'SCHEDULED';
      } else if (!manualSchedule.enabled && job.status === 'SCHEDULED') {
        newStatus = 'APPROVED';
      }

      await base44.entities.Job.update(job.id, {
        customerId: formData.customerId,
        deliveryTypeId: formData.deliveryTypeId,
        pickupLocationId: formData.pickupLocationId,
        deliveryLocation: formData.deliveryLocation,
        deliveryLatitude: formData.deliveryLatitude || undefined,
        deliveryLongitude: formData.deliveryLongitude || undefined,
        requestedDate: formData.requestedDate,
        totalUnits: formData.totalUnits ? Number(formData.totalUnits) : undefined,
        poSalesDocketNumber: docketInfo,
        deliveryWindow: formData.deliveryWindow || undefined,
        sqm: formData.sqm ? Number(formData.sqm) : undefined,
        weightKg: formData.weightKg ? Number(formData.weightKg) : undefined,
        siteContactName: formData.siteContactName,
        siteContactPhone: formData.siteContactPhone,
        deliveryNotes: formData.deliveryNotes || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        customerName: selectedCustomer.customerName,
        deliveryTypeName: selectedType.name,
        pickupLocation: `${selectedLocation.company} - ${selectedLocation.name}`,
        status: newStatus,
        isDifficultDelivery: isDifficult,
        requiresManitou: formData.requiresManitou || false,
        nonStandardDelivery: hasNonStandard ? {
          longWalk: formData.nonStandardDelivery.longWalk || false,
          longWalkDistance: formData.nonStandardDelivery.longWalkDistance ? Number(formData.nonStandardDelivery.longWalkDistance) : undefined,
          passUp: formData.nonStandardDelivery.passUp || false,
          passDown: formData.nonStandardDelivery.passDown || false,
          stairs: formData.nonStandardDelivery.stairs || false,
          stairsCount: formData.nonStandardDelivery.stairsCount ? Number(formData.nonStandardDelivery.stairsCount) : undefined,
          fourManNeeded: formData.nonStandardDelivery.fourManNeeded || false,
          moreThan2000Sqm: formData.nonStandardDelivery.moreThan2000Sqm || false,
          zoneC: formData.nonStandardDelivery.zoneC || false,
          other: formData.nonStandardDelivery.other || false,
          otherDetails: formData.nonStandardDelivery.otherDetails || undefined
        } : undefined
      });

      // Handle manual schedule assignment
      if (manualSchedule.enabled && manualSchedule.truckId && manualSchedule.timeSlotId) {
        const existingAssignment = assignments[0];
        if (existingAssignment) {
          // Update existing assignment
          await base44.entities.Assignment.update(existingAssignment.id, {
            truckId: manualSchedule.truckId,
            timeSlotId: manualSchedule.timeSlotId,
            slotPosition: parseInt(manualSchedule.slotPosition) || 1,
            date: formData.requestedDate
          });
        } else {
          // Create new assignment
          await base44.entities.Assignment.create({
            jobId: job.id,
            truckId: manualSchedule.truckId,
            timeSlotId: manualSchedule.timeSlotId,
            slotPosition: parseInt(manualSchedule.slotPosition) || 1,
            date: formData.requestedDate
          });
        }
      } else if (!manualSchedule.enabled && assignments[0]) {
        // Remove assignment if manual schedule is disabled
        await base44.entities.Assignment.delete(assignments[0].id);
      }

      toast({
        title: "Job Updated!",
        description: `Job for ${selectedCustomer.customerName} has been updated successfully.`,
      });
      
      onJobUpdated();
      onOpenChange(false);

    } catch (error) {
      toast({
        title: "Error Updating Job",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
      console.error("Failed to update job:", error);
    } finally {
      setLoading(false);
    }
  };

  // Reset dataLoaded when dialog closes
  useEffect(() => {
    if (!open) {
      setDataLoaded(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Job</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <ScrollArea className="h-[65vh] pr-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              
              <div>
                <label htmlFor="customerId" className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                <Select name="customerId" onValueChange={(value) => handleSelectChange('customerId', value)} value={formData.customerId} required>
                  <SelectTrigger id="customerId"><SelectValue placeholder="Select a customer..." /></SelectTrigger>
                  <SelectContent>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.customerName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="deliveryTypeId" className="block text-sm font-medium text-gray-700 mb-1">Delivery Type</label>
                <Select name="deliveryTypeId" onValueChange={(value) => handleSelectChange('deliveryTypeId', value)} value={formData.deliveryTypeId} required>
                  <SelectTrigger id="deliveryTypeId"><SelectValue placeholder="Select delivery type..." /></SelectTrigger>
                  <SelectContent>
                    {deliveryTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {isUnitsDelivery && (
                <div>
                  <label htmlFor="totalUnits" className="block text-sm font-medium text-gray-700 mb-1">Number of Dockets/Units</label>
                  <Input id="totalUnits" name="totalUnits" type="number" value={formData.totalUnits} onChange={handleChange} placeholder="e.g. 8" />
                </div>
              )}

              {formData.deliveryTypeId && !isUnitsDelivery && (
                <div>
                  <label htmlFor="poSalesDocketNumber" className="block text-sm font-medium text-gray-700 mb-1">PO/Docket Number</label>
                  <Input id="poSalesDocketNumber" name="poSalesDocketNumber" value={formData.poSalesDocketNumber} onChange={handleChange} placeholder="e.g., PO12345 or DOC789" />
                </div>
              )}

              <div>
                <label htmlFor="pickupLocationId" className="block text-sm font-medium text-gray-700 mb-1">Pickup Location</label>
                <Select name="pickupLocationId" onValueChange={(value) => handleSelectChange('pickupLocationId', value)} value={formData.pickupLocationId} required>
                  <SelectTrigger id="pickupLocationId"><SelectValue placeholder="Select pickup location..." /></SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-[200px]">
                      {pickupLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.company} - {l.name}</SelectItem>)}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>

              {isUnitsDelivery && formData.totalUnits > 0 && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">PO/Docket Numbers & Notes</label>
                  <div className="space-y-3">
                    {docketNumbers.map((docket, index) => (
                      <div key={index} className="grid grid-cols-2 gap-3">
                        <div>
                          <Input
                            id={`docket-${index}`}
                            value={docket}
                            onChange={(e) => handleDocketNumberChange(index, e.target.value)}
                            placeholder={`Docket ${index + 1}`}
                          />
                        </div>
                        <div>
                          <Input
                            id={`docket-note-${index}`}
                            value={docketNotes[index] || ''}
                            onChange={(e) => handleDocketNoteChange(index, e.target.value)}
                            placeholder="e.g. Unit 123"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="md:col-span-2">
                <label htmlFor="deliveryLocation" className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Address <span className="text-red-500">*</span>
                </label>
                <Input
                  id="deliveryLocation"
                  name="deliveryLocation"
                  value={formData.deliveryLocation}
                  onChange={handleChange}
                  placeholder="Enter delivery address"
                  required
                />
              </div>

              <div>
                <label htmlFor="requestedDate" className="block text-sm font-medium text-gray-700 mb-1">Requested Date</label>
                <Input id="requestedDate" name="requestedDate" type="date" value={formData.requestedDate} onChange={handleChange} required />
              </div>

              {formData.requestedDate && (
                <div>
                  <label htmlFor="deliveryWindow" className="block text-sm font-medium text-gray-700 mb-1">Delivery Window</label>
                  <Select name="deliveryWindow" onValueChange={(value) => handleSelectChange('deliveryWindow', value)} value={formData.deliveryWindow}>
                    <SelectTrigger id="deliveryWindow"><SelectValue placeholder="Select delivery window..." /></SelectTrigger>
                    <SelectContent>
                      {DELIVERY_WINDOWS.map(window => (
                        <SelectItem key={window.id} value={window.id}>{window.label}</SelectItem>
                      ))}
                      <SelectItem value="Any Time">Any Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Manual Schedule Section - Only for Admin/Dispatcher */}
              {currentUser && (currentUser.role === 'admin' || currentUser.appRole === 'dispatcher') && formData.requestedDate && (
                <div className="md:col-span-2 border-t pt-4 mt-2">
                  <div className="flex items-center space-x-2 mb-3">
                    <input
                      type="checkbox"
                      id="manualScheduleEnabled"
                      checked={manualSchedule.enabled}
                      onChange={(e) => setManualSchedule(prev => ({ ...prev, enabled: e.target.checked }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="manualScheduleEnabled" className="text-sm font-semibold text-gray-900">
                      Manually Assign to Schedule
                    </label>
                  </div>

                  {manualSchedule.enabled && (
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="manualDate" className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date *</label>
                        <Input 
                          id="manualDate" 
                          name="requestedDate" 
                          type="date" 
                          value={formData.requestedDate} 
                          onChange={handleChange} 
                          required 
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label htmlFor="manualTruck" className="block text-sm font-medium text-gray-700 mb-1">Truck *</label>
                          <Select 
                            value={manualSchedule.truckId} 
                            onValueChange={(value) => setManualSchedule(prev => ({ ...prev, truckId: value }))}
                          >
                            <SelectTrigger id="manualTruck">
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
                          <label htmlFor="manualTimeSlot" className="block text-sm font-medium text-gray-700 mb-1">Time Slot *</label>
                          <Select 
                            value={manualSchedule.timeSlotId} 
                            onValueChange={(value) => setManualSchedule(prev => ({ ...prev, timeSlotId: value }))}
                          >
                            <SelectTrigger id="manualTimeSlot">
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
                          <label htmlFor="manualSlotPosition" className="block text-sm font-medium text-gray-700 mb-1">Slot Position *</label>
                          <Select 
                            value={manualSchedule.slotPosition.toString()} 
                            onValueChange={(value) => setManualSchedule(prev => ({ ...prev, slotPosition: parseInt(value) }))}
                          >
                            <SelectTrigger id="manualSlotPosition">
                              <SelectValue placeholder="Select slot..." />
                            </SelectTrigger>
                            <SelectContent>
                              {SLOT_POSITIONS.map(slot => (
                                <SelectItem key={slot.value} value={slot.value.toString()}>{slot.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="md:col-span-2 grid grid-cols-2 gap-6">
                <div>
                  <label htmlFor="sqm" className="block text-sm font-medium text-gray-700 mb-1">Total Square Meters (m²)</label>
                  <Input id="sqm" name="sqm" type="number" value={formData.sqm} onChange={handleChange} placeholder="e.g., 850" />
                </div>
                <div>
                  <label htmlFor="weightKg" className="block text-sm font-medium text-gray-700 mb-1">Total Weight (kg)</label>
                  <Input id="weightKg" name="weightKg" type="number" value={formData.weightKg} onChange={handleChange} placeholder="e.g., 12000" />
                </div>
              </div>

              <div>
                <label htmlFor="siteContactName" className="block text-sm font-medium text-gray-700 mb-1">Site Contact Name</label>
                <Input id="siteContactName" name="siteContactName" value={formData.siteContactName} onChange={handleChange} placeholder="e.g., John Smith" required />
              </div>
              <div>
                <label htmlFor="siteContactPhone" className="block text-sm font-medium text-gray-700 mb-1">Site Contact Phone</label>
                <Input id="siteContactPhone" name="siteContactPhone" value={formData.siteContactPhone} onChange={handleChange} placeholder="e.g., 0412 345 678" required />
              </div>

              <div className="md:col-span-2 border-t pt-4 mt-2">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Non-standard Delivery</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        id="longWalk"
                        checked={formData.nonStandardDelivery.longWalk}
                        onChange={(e) => handleNonStandardChange('longWalk', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="longWalk" className="text-sm font-medium text-gray-700">
                        Long Walk
                      </label>
                    </div>
                    {formData.nonStandardDelivery.longWalk && (
                      <Input
                        type="number"
                        placeholder="Distance (metres)"
                        value={formData.nonStandardDelivery.longWalkDistance}
                        onChange={(e) => handleNonStandardChange('longWalkDistance', e.target.value)}
                        className="mt-1"
                      />
                    )}
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="passUp"
                        checked={formData.nonStandardDelivery.passUp}
                        onChange={(e) => handleNonStandardChange('passUp', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="passUp" className="text-sm font-medium text-gray-700">
                        Pass Up
                      </label>
                    </div>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="passDown"
                        checked={formData.nonStandardDelivery.passDown}
                        onChange={(e) => handleNonStandardChange('passDown', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="passDown" className="text-sm font-medium text-gray-700">
                        Pass Down
                      </label>
                    </div>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        id="stairs"
                        checked={formData.nonStandardDelivery.stairs}
                        onChange={(e) => handleNonStandardChange('stairs', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="stairs" className="text-sm font-medium text-gray-700">
                        Stairs (No Manitou)
                      </label>
                    </div>
                    {formData.nonStandardDelivery.stairs && (
                      <Input
                        type="number"
                        placeholder="Number of stairs"
                        value={formData.nonStandardDelivery.stairsCount}
                        onChange={(e) => handleNonStandardChange('stairsCount', e.target.value)}
                        className="mt-1"
                      />
                    )}
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="fourManNeeded"
                        checked={formData.nonStandardDelivery.fourManNeeded}
                        onChange={(e) => handleNonStandardChange('fourManNeeded', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="fourManNeeded" className="text-sm font-medium text-gray-700">
                        4 Man Needed
                      </label>
                    </div>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="moreThan2000Sqm"
                        checked={formData.nonStandardDelivery.moreThan2000Sqm}
                        onChange={(e) => handleNonStandardChange('moreThan2000Sqm', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="moreThan2000Sqm" className="text-sm font-medium text-gray-700">
                        More than 2000m² total
                      </label>
                    </div>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="zoneC"
                        checked={formData.nonStandardDelivery.zoneC}
                        onChange={(e) => handleNonStandardChange('zoneC', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="zoneC" className="text-sm font-medium text-gray-700">
                        Zone C (150km+ from pickup)
                      </label>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center space-x-2 mb-2">
                      <input
                        type="checkbox"
                        id="other"
                        checked={formData.nonStandardDelivery.other}
                        onChange={(e) => handleNonStandardChange('other', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="other" className="text-sm font-medium text-gray-700">
                        Other
                      </label>
                    </div>
                    {formData.nonStandardDelivery.other && (
                      <Input
                        type="text"
                        placeholder="Please specify..."
                        value={formData.nonStandardDelivery.otherDetails}
                        onChange={(e) => handleNonStandardChange('otherDetails', e.target.value)}
                        className="mt-1"
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="deliveryNotes" className="block text-sm font-medium text-gray-700 mb-1">Delivery Notes</label>
                <Textarea id="deliveryNotes" name="deliveryNotes" value={formData.deliveryNotes} onChange={handleChange} placeholder="e.g., Site access via Gate 3." />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploadingAttachment}
                    asChild
                  >
                    <label className="cursor-pointer flex items-center justify-center">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        multiple
                        onChange={handleAttachmentUpload}
                        className="hidden"
                        disabled={uploadingAttachment}
                      />
                      {uploadingAttachment ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload Files (PDF, Images, Documents)
                        </>
                      )}
                    </label>
                  </Button>
                  
                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      {attachments.map((url, index) => {
                        const fileName = url.split('/').pop() || `File ${index + 1}`;
                        return (
                          <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                            <span className="text-sm text-gray-700 truncate flex-1">{fileName}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveAttachment(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || uploadingAttachment}>
              {loading ? 'Updating...' : 'Update Job'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}