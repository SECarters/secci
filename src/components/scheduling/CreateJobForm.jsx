import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from "@/components/ui/use-toast";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Loader2, X, Plus, Trash2, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { extractDeliveryData } from '@/functions/extractDeliveryData';
import AddressInput from './AddressInput';


const TRUCKS = [
  { id: 'ACCO1', name: 'ACCO1' },
  { id: 'ACCO2', name: 'ACCO2' },
  { id: 'FUSO', name: 'FUSO' },
  { id: 'ISUZU', name: 'ISUZU' },
  { id: 'UD', name: 'UD' }
];

const DELIVERY_WINDOWS = [
  { id: 'first-am', label: '6-8am (1st AM)' },
  { id: 'second-am', label: '8-10am (2nd AM)' },
  { id: 'lunch', label: '10am-12pm (LUNCH)' },
  { id: 'first-pm', label: '12-2pm (1st PM)' },
  { id: 'second-pm', label: '2-4pm (2nd PM)' }
];

export default function CreateJobForm({ open, onOpenChange, onJobCreated }) {
  const [customers, setCustomers] = useState([]);
  const [deliveryTypes, setDeliveryTypes] = useState([]);
  const [pickupLocations, setPickupLocations] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    customerId: '',
    deliveryTypeId: '',
    pickupLocationId: '',
    deliveryLocation: '',
    deliveryLatitude: null,
    deliveryLongitude: null,
    customerReference: '',
    requestedDate: '',
    totalUnits: '',
    totalSheetQty: '',
    poSalesDocketNumber: '',
    deliveryWindow: '',
    sqm: '',
    weightKg: '',
    siteContactName: '',
    siteContactPhone: '',
    deliveryNotes: '',
    sheetList: [],
    scheduleTruckId: '',
    scheduleDate: '',
    scheduleTimeSlot: '',
    scheduleSlotPosition: '1',
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
  const [docketNumbers, setDocketNumbers] = useState([]);
  const [docketNotes, setDocketNotes] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [manualSheetEntry, setManualSheetEntry] = useState({ description: '', quantity: '', m2: '', unit: 'sheets', weight: '' });
  const [extractionLoading, setExtractionLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [suggestions, setSuggestions] = useState({ deliveryType: null, requiresManitou: false, difficultDelivery: null });
  
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      const fetchData = async () => {
        setLoading(true);
        const [customers, types, locations, user] = await Promise.all([
          base44.entities.Customer.filter({ status: 'ACTIVE' }),
          base44.entities.DeliveryType.list(),
          base44.entities.PickupLocation.filter({ status: 'ACTIVE' }),
          base44.auth.me()
        ]);
        setCustomers(customers);
        setDeliveryTypes(types);
        setPickupLocations(locations);
        setCurrentUser(user);
        setLoading(false);
      };
      fetchData();
    }
  }, [open]);

  useEffect(() => {
    if (formData.customerId && customers.length > 0 && pickupLocations.length > 0) {
      const selectedCustomer = customers.find(c => c.id === formData.customerId);
      
      if (selectedCustomer) {
        const updates = {};
        
        if (selectedCustomer.regularSiteContactName && !formData.siteContactName) {
          updates.siteContactName = selectedCustomer.regularSiteContactName;
        }
        
        if (selectedCustomer.regularSiteContactNumber && !formData.siteContactPhone) {
          updates.siteContactPhone = selectedCustomer.regularSiteContactNumber;
        }
        
        if (selectedCustomer.deliveryInstructions && !formData.deliveryNotes) {
          updates.deliveryNotes = selectedCustomer.deliveryInstructions;
        }
        
        // Skip auto-fill pickup location for Southpak customer
        const isSouthpak = selectedCustomer.customerName?.toLowerCase().includes('southpak');
        
        if (selectedCustomer.usualSupplier && !formData.pickupLocationId && !isSouthpak) {
          const matchingLocation = pickupLocations.find(
            loc => loc.sheetType?.toLowerCase() === selectedCustomer.usualSupplier.toLowerCase()
          );
          if (matchingLocation) {
            updates.pickupLocationId = matchingLocation.id;
          }
        }
        
        if (Object.keys(updates).length > 0) {
          setFormData(prev => ({ ...prev, ...updates }));
        }
      }
    }
  }, [formData.customerId, customers, pickupLocations, formData.siteContactName, formData.siteContactPhone, formData.deliveryNotes, formData.pickupLocationId]);

  // Smart detection based on notes and descriptions
  useEffect(() => {
    const detectPatterns = () => {
      const notes = (formData.deliveryNotes || '').toLowerCase();
      const reference = (formData.customerReference || '').toLowerCase();
      const allText = `${notes} ${reference}`;
      
      const newSuggestions = { deliveryType: null, requiresManitou: false, difficultDelivery: null };
      
      // Detect delivery type patterns
      if (allText.match(/\b(unit|units|apartment|level|floor|storey|story)\b/i)) {
        const unitUpType = deliveryTypes.find(dt => dt.code === 'UNITUP' || dt.name?.toLowerCase().includes('unit up'));
        if (unitUpType && !formData.deliveryTypeId) {
          newSuggestions.deliveryType = unitUpType.id;
        }
      } else if (allText.match(/\b(crane|lift|hoist)\b/i)) {
        const craneType = deliveryTypes.find(dt => dt.code === 'CRANE' || dt.name?.toLowerCase().includes('crane'));
        if (craneType && !formData.deliveryTypeId) {
          newSuggestions.deliveryType = craneType.id;
        }
      } else if (allText.match(/\b(manitou|forklift|telehandler)\b/i)) {
        const mansType = deliveryTypes.find(dt => dt.code === 'MANS' || dt.name?.toLowerCase().includes('manitou'));
        if (mansType && !formData.deliveryTypeId) {
          newSuggestions.deliveryType = mansType.id;
        }
      }
      
      // Detect Manitou requirement
      if (allText.match(/\b(manitou|forklift|telehandler|pass up|pass down|upstairs|level|floor|storey|story)\b/i)) {
        newSuggestions.requiresManitou = true;
      }
      
      // Detect difficult delivery patterns
      const difficultKeywords = [
        { pattern: /\b(long walk|far from|distant|long carry)\b/i, reason: 'Long Walk' },
        { pattern: /\b(stair|stairs|steps|staircase|upstairs|downstairs)\b/i, reason: 'Stairs' },
        { pattern: /\b(pass up|pass down|lift up|hand up|throw up|throw down)\b/i, reason: 'Pass Up/Down' },
        { pattern: /\b(traffic|traffic control|road closure|blocked access)\b/i, reason: 'Traffic Control' },
        { pattern: /\b(narrow|tight|difficult access|restricted access|hard to access)\b/i, reason: 'Difficult Access' },
        { pattern: /\b(4 man|four man|extra hands|additional help)\b/i, reason: 'Extra Labor Required' }
      ];
      
      for (const keyword of difficultKeywords) {
        if (allText.match(keyword.pattern)) {
          newSuggestions.difficultDelivery = keyword.reason;
          break;
        }
      }
      
      // Auto-check non-standard delivery checkboxes based on keywords
      const updates = {};
      if (allText.match(/\b(long walk|far from|distant)\b/i) && !formData.nonStandardDelivery.longWalk) {
        updates.longWalk = true;
      }
      if (allText.match(/\b(pass up|lift up|hand up)\b/i) && !formData.nonStandardDelivery.passUp) {
        updates.passUp = true;
      }
      if (allText.match(/\b(pass down|throw down)\b/i) && !formData.nonStandardDelivery.passDown) {
        updates.passDown = true;
      }
      if (allText.match(/\b(stair|stairs|steps)\b/i) && !formData.nonStandardDelivery.stairs) {
        updates.stairs = true;
      }
      if (allText.match(/\b(4 man|four man)\b/i) && !formData.nonStandardDelivery.fourManNeeded) {
        updates.fourManNeeded = true;
      }
      
      if (Object.keys(updates).length > 0) {
        setFormData(prev => ({
          ...prev,
          nonStandardDelivery: { ...prev.nonStandardDelivery, ...updates }
        }));
      }
      
      setSuggestions(newSuggestions);
    };
    
    if (deliveryTypes.length > 0 && (formData.deliveryNotes || formData.customerReference)) {
      detectPatterns();
    }
  }, [formData.deliveryNotes, formData.customerReference, deliveryTypes, formData.deliveryTypeId, formData.nonStandardDelivery]);

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
          setDocketNotes([...currentNotes, ...Array(Math.max(0, numUnits - currentNotes.length)).fill('')]);
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

  const handleDocumentExtraction = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtractionLoading(true);
    try {
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadResult.file_url;
      
      setAttachments(prev => [...prev, fileUrl]);

      const response = await extractDeliveryData({ fileUrl });
      console.log('Extraction response:', response);
      
      // Handle both response.data and direct response formats
      const responseData = response.data || response;
      
      if (responseData?.success && responseData?.data) {
        const extracted = responseData.data;
        setExtractedData(extracted);

        const updates = {};

        if (extracted.delivery_address) {
          updates.deliveryLocation = extracted.delivery_address;
        }
        if (extracted.delivery_notes) {
          updates.deliveryNotes = extracted.delivery_notes;
        }
        if (extracted.order_number) {
          updates.poSalesDocketNumber = extracted.order_number;
        }
        if (extracted.customer_name) {
          const matchedCustomer = customers.find(c => 
            c.customerName?.toLowerCase().includes(extracted.customer_name.toLowerCase()) ||
            extracted.customer_name.toLowerCase().includes(c.customerName?.toLowerCase())
          );
          if (matchedCustomer) {
            updates.customerId = matchedCustomer.id;

            // Special handling: Bayside Plasterboard should default to Morningside location
            if (matchedCustomer.customerName?.toLowerCase().includes('bayside')) {
              const morningsideLocation = pickupLocations.find(loc => 
                loc.company?.toLowerCase().includes('bayside') && 
                loc.name?.toLowerCase().includes('morningside')
              );
              if (morningsideLocation) {
                updates.pickupLocationId = morningsideLocation.id;
              }
            }
          }
        }
        if (extracted.shipping_date) {
          try {
            const parsedDate = new Date(extracted.shipping_date);
            if (!isNaN(parsedDate.getTime())) {
              updates.requestedDate = format(parsedDate, 'yyyy-MM-dd');
            }
          } catch (err) {
            console.warn('Could not parse shipping date');
          }
        }
        if (extracted.site_contact) {
          updates.siteContactName = extracted.site_contact;
        }
        if (extracted.site_contact_phone) {
          updates.siteContactPhone = extracted.site_contact_phone;
        }
        if (extracted.total_m2) {
          updates.sqm = extracted.total_m2;
        }
        if (extracted.total_weight) {
          updates.weightKg = extracted.total_weight;
        }
        if (extracted.total_sheets) {
          updates.totalSheetQty = extracted.total_sheets;
        }

        if (extracted.line_items && extracted.line_items.length > 0) {
          const sheetListItems = extracted.line_items.map(item => ({
            description: item.product_description || item.product_code || '',
            quantity: item.quantity || 0,
            unit: item.unit || 'sheets',
            m2: item.m2 || null,
            weight: item.weight || null
          })).filter(item => item.description);
          
          if (sheetListItems.length > 0) {
            updates.sheetList = sheetListItems;
          }
        }

        if (extracted.supplier_name) {
          const supplierLower = extracted.supplier_name.toLowerCase();
          
          // Try exact match first
          let matchedLocation = pickupLocations.find(loc => 
            loc.company?.toLowerCase() === supplierLower
          );
          
          // If no exact match, try matching with location name included (e.g., "Bayside Plasterboard Morningside")
          if (!matchedLocation) {
            matchedLocation = pickupLocations.find(loc => {
              const companyLower = loc.company?.toLowerCase() || '';
              const locationNameLower = loc.name?.toLowerCase() || '';
              return supplierLower.includes(companyLower) && supplierLower.includes(locationNameLower);
            });
          }
          
          // If still no match, try partial company match but only if there's a single result
          if (!matchedLocation) {
            const partialMatches = pickupLocations.filter(loc => 
              loc.company?.toLowerCase().includes(supplierLower) ||
              supplierLower.includes(loc.company?.toLowerCase())
            );
            
            // Only auto-select if there's exactly one match to avoid ambiguity
            if (partialMatches.length === 1) {
              matchedLocation = partialMatches[0];
            }
          }
          
          if (matchedLocation) {
            updates.pickupLocationId = matchedLocation.id;
          }
        }

        setFormData(prev => ({ ...prev, ...updates }));

        toast({
          title: "Document Extracted",
          description: "Form has been auto-filled with extracted data. Please review and edit as needed.",
        });
      } else {
        toast({
          title: "Extraction Complete",
          description: "Document processed but no data could be extracted. Please fill the form manually.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Document extraction error:', error);
      toast({
        title: "Extraction Failed",
        description: "Failed to extract data from document. Please fill the form manually.",
        variant: "destructive",
      });
    } finally {
      e.target.value = '';
      setExtractionLoading(false);
    }
  };

  const selectedDeliveryType = deliveryTypes.find(t => t.id === formData.deliveryTypeId);
  const isUnitsDelivery = selectedDeliveryType?.name?.toLowerCase().includes('unit');
  const canScheduleDirectly = currentUser && (currentUser.role === 'admin' || currentUser.appRole === 'dispatcher');
  const selectedCustomer = customers.find(c => c.id === formData.customerId);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const isCustomer = currentUser && currentUser.role !== 'admin' && currentUser.appRole !== 'dispatcher';
    
    if (isCustomer) {
      setShowConfirmation(true);
    } else {
      handleConfirmSubmit();
    }
  };

  const handleConfirmSubmit = async () => {
    setLoading(true);
    try {
      if (!formData.customerId || !formData.deliveryTypeId || !formData.pickupLocationId) {
        throw new Error("Please fill in all required fields: Customer, Delivery Type, and Pickup Location.");
      }

      const selectedCustomer = customers.find(c => c.id === formData.customerId);
      const selectedType = deliveryTypes.find(t => t.id === formData.deliveryTypeId);
      const selectedLocation = pickupLocations.find(l => l.id === formData.pickupLocationId);
      
      if (!selectedCustomer) {
        throw new Error("Selected customer not found. Please select a valid customer.");
      }
      if (!selectedType) {
        throw new Error("Selected delivery type not found. Please select a valid delivery type.");
      }
      if (!selectedLocation) {
        throw new Error("Selected pickup location not found. Please select a valid pickup location.");
      }

      const docketInfo = isUnitsDelivery && docketNumbers.length > 0
        ? docketNumbers.map((num, idx) => {
            const note = docketNotes[idx]?.trim();
            return note ? `${num} (${note})` : num;
          }).filter(d => d.trim()).join(', ')
        : formData.poSalesDocketNumber;

      const isDirectlyScheduled = canScheduleDirectly && formData.scheduleTruckId && formData.scheduleDate && formData.scheduleTimeSlot;
      const jobStatus = isDirectlyScheduled ? 'SCHEDULED' : 'APPROVED';

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

      const newJob = await base44.entities.Job.create({
        customerId: formData.customerId,
        deliveryTypeId: formData.deliveryTypeId,
        pickupLocationId: formData.pickupLocationId,
        deliveryLocation: formData.deliveryLocation,
        deliveryLatitude: formData.deliveryLatitude,
        deliveryLongitude: formData.deliveryLongitude,
        requestedDate: formData.requestedDate,
        totalUnits: formData.totalUnits ? Number(formData.totalUnits) : undefined,
        totalSheetQty: formData.totalSheetQty ? Number(formData.totalSheetQty) : undefined,
        poSalesDocketNumber: docketInfo,
        deliveryWindow: formData.deliveryWindow || undefined,
        sqm: formData.sqm ? Number(formData.sqm) : undefined,
        weightKg: formData.weightKg ? Number(formData.weightKg) : undefined,
        siteContactName: formData.siteContactName,
        siteContactPhone: formData.siteContactPhone,
        deliveryNotes: formData.deliveryNotes || undefined,
        sheetList: formData.sheetList.length > 0 ? formData.sheetList : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        customerName: selectedCustomer.customerName,
        customerReference: formData.customerReference || undefined,
        deliveryTypeName: selectedType.name,
        pickupLocation: `${selectedLocation.company} - ${selectedLocation.name}`,
        status: jobStatus,
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

      if (isDirectlyScheduled) {
        await base44.entities.Assignment.create({
          jobId: newJob.id,
          truckId: formData.scheduleTruckId,
          timeSlotId: formData.scheduleTimeSlot,
          slotPosition: parseInt(formData.scheduleSlotPosition) || 1,
          date: formData.scheduleDate,
          status: 'PENDING'
        });
      }

      try {
        if (currentUser?.email) {
          await base44.functions.invoke('sendConfirmNewJobEmail', {
            jobId: newJob.id,
            recipientEmail: currentUser.email,
            recipientName: currentUser.full_name || selectedCustomer.customerName
          });
        }

        await base44.functions.invoke('sendNewJobCreatedEmail', {
          jobId: newJob.id
        });

        if (isDirectlyScheduled && selectedCustomer.contactEmail) {
          await base44.functions.invoke('sendJobScheduledEmail', {
            jobId: newJob.id,
            customerEmail: selectedCustomer.contactEmail,
            customerName: selectedCustomer.customerName,
            truckName: TRUCKS.find(t => t.id === formData.scheduleTruckId)?.name || 'Unknown Truck',
            date: formData.scheduleDate,
            timeSlot: formData.scheduleTimeSlot
          });
        }
      } catch (emailError) {
        console.error('Failed to send email notifications:', emailError);
      }

      toast({
        title: "Job Created!",
        description: `Job for ${selectedCustomer.customerName} has been created${isDirectlyScheduled ? ' and scheduled' : ' and is ready for scheduling'}.`,
      });
      
      setShowConfirmation(false);
      onJobCreated();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        customerId: '', deliveryTypeId: '', pickupLocationId: '', deliveryLocation: '', 
        deliveryLatitude: null, deliveryLongitude: null,
        customerReference: '',
        requestedDate: '', 
        totalUnits: '', totalSheetQty: '', poSalesDocketNumber: '', deliveryWindow: '',
        sqm: '', weightKg: '', siteContactName: '', siteContactPhone: '', deliveryNotes: '',
        sheetList: [],
        scheduleTruckId: '', scheduleDate: '', scheduleTimeSlot: '', scheduleSlotPosition: '1',
        nonStandardDelivery: {
          longWalk: false, longWalkDistance: '', passUp: false, passDown: false, stairs: false,
          stairsCount: '', fourManNeeded: false, moreThan2000Sqm: false, zoneC: false, other: false, otherDetails: ''
        }
      });
      setDocketNumbers([]);
      setDocketNotes([]);
      setAttachments([]);
      setExtractedData(null);

    } catch (error) {
      toast({
        title: "Error Creating Job",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
      console.error("Failed to create job:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) return null;

  return (
    <>
      <Dialog open={open && !showConfirmation} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Job</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
          
            <ScrollArea className="h-[65vh] pr-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                
                <div className="md:col-span-2 border-t pt-4 mt-2">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">AI Document Extraction</h3>
                  <p className="text-xs text-gray-500 mb-3">Upload a delivery docket or order document to auto-fill the form</p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={extractionLoading}
                    className="w-full border-dashed border-2 border-blue-300 bg-blue-50 hover:bg-blue-100"
                    asChild
                  >
                    <label className="cursor-pointer flex items-center justify-center py-4">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleDocumentExtraction}
                        className="hidden"
                        disabled={extractionLoading}
                      />
                      {extractionLoading ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin text-blue-600" />
                          <span className="text-blue-700">Extracting data from document...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-5 w-5 mr-2 text-blue-600" />
                          <span className="text-blue-700 font-medium">Upload Document for AI Extraction</span>
                        </>
                      )}
                    </label>
                  </Button>
                  {extractedData && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
                      ✓ Data extracted and form auto-filled. Please review the fields below.
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="customerId" className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                  <Select name="customerId" onValueChange={(value) => handleSelectChange('customerId', value)} value={formData.customerId} required>
                    <SelectTrigger id="customerId"><SelectValue placeholder="Select a customer..." /></SelectTrigger>
                    <SelectContent>
                      {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.customerName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {selectedCustomer?.buildingPlasteringCompany && (
                    <p className="text-xs text-gray-500 mt-1">
                      Building/Plastering: {selectedCustomer.buildingPlasteringCompany}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="customerReference" className="block text-sm font-medium text-gray-700 mb-1">Customer Reference</label>
                  <Input id="customerReference" name="customerReference" value={formData.customerReference} onChange={handleChange} placeholder="e.g. Smith Plastering - Job 123" />
                  <p className="text-xs text-gray-500 mt-1">Your client's name or reference (for subcontract work)</p>
                </div>

                <div>
                  <label htmlFor="deliveryTypeId" className="block text-sm font-medium text-gray-700 mb-1">Delivery Type</label>
                  <Select name="deliveryTypeId" onValueChange={(value) => handleSelectChange('deliveryTypeId', value)} value={formData.deliveryTypeId} required>
                    <SelectTrigger id="deliveryTypeId"><SelectValue placeholder="Select delivery type..." /></SelectTrigger>
                    <SelectContent>
                      {deliveryTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {suggestions.deliveryType && !formData.deliveryTypeId && (
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleSelectChange('deliveryTypeId', suggestions.deliveryType)}
                        className="text-xs bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Use Suggested: {deliveryTypes.find(dt => dt.id === suggestions.deliveryType)?.name}
                      </Button>
                    </div>
                  )}
                  {suggestions.requiresManitou && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                      ⚠️ This job may require Manitou equipment based on the description
                    </div>
                  )}
                </div>

                {isUnitsDelivery && (
                  <>
                    <div>
                      <label htmlFor="totalUnits" className="block text-sm font-medium text-gray-700 mb-1">Number of Dockets</label>
                      <Input id="totalUnits" name="totalUnits" type="number" value={formData.totalUnits} onChange={handleChange} placeholder="e.g. 3" />
                      <p className="text-xs text-gray-500 mt-1">How many separate dockets/orders</p>
                    </div>

                    <div>
                      <label htmlFor="totalSheetQty" className="block text-sm font-medium text-gray-700 mb-1">Total Sheet Quantity</label>
                      <Input id="totalSheetQty" name="totalSheetQty" type="number" value={formData.totalSheetQty} onChange={handleChange} placeholder="e.g. 98" />
                      <p className="text-xs text-gray-500 mt-1">Total number of sheets across all dockets</p>
                    </div>
                  </>
                )}

                {formData.deliveryTypeId && !isUnitsDelivery && (
                  <>
                    <div>
                      <label htmlFor="poSalesDocketNumber" className="block text-sm font-medium text-gray-700 mb-1">PO/Docket Number</label>
                      <Input id="poSalesDocketNumber" name="poSalesDocketNumber" value={formData.poSalesDocketNumber} onChange={handleChange} placeholder="e.g., PO12345 or DOC789" />
                    </div>

                    <div>
                      <label htmlFor="totalSheetQty" className="block text-sm font-medium text-gray-700 mb-1">Total Sheet Quantity</label>
                      <Input id="totalSheetQty" name="totalSheetQty" type="number" value={formData.totalSheetQty} onChange={handleChange} placeholder="e.g. 98" />
                      <p className="text-xs text-gray-500 mt-1">Total number of sheets</p>
                    </div>
                  </>
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
                  <AddressInput
                    value={formData.deliveryLocation}
                    onChange={(value) => setFormData(prev => ({ ...prev, deliveryLocation: value }))}
                    onAddressConfirmed={(data) => {
                      setFormData(prev => ({
                        ...prev,
                        deliveryLocation: data.address,
                        deliveryLatitude: data.latitude,
                        deliveryLongitude: data.longitude,
                        deliveryStreetNumber: data.streetNumber,
                        deliveryStreetName: data.streetName,
                        deliveryStreetType: data.streetType,
                        deliverySuburb: data.suburb,
                        deliveryState: data.state,
                        deliveryPostcode: data.postcode
                      }));
                    }}
                    placeholder="Start typing to search saved addresses..."
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
                          <SelectItem key={window.id} value={window.label}>{window.label}</SelectItem>
                        ))}
                        <SelectItem value="Any Time">Any Time</SelectItem>
                      </SelectContent>
                    </Select>
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
                  {suggestions.difficultDelivery && (
                    <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs text-orange-800 flex items-center justify-between">
                      <span>⚠️ Difficult delivery detected: {suggestions.difficultDelivery}</span>
                    </div>
                  )}
                </div>

                <div className="md:col-span-2 border-t pt-4 mt-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sheet List (Optional)</label>
                  <p className="text-xs text-gray-500 mb-3">Add itemized list of sheets/boards for this delivery</p>
                  
                  {formData.sheetList.length > 0 && (
                    <div className="mb-3 border rounded-lg overflow-hidden overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-2 font-medium text-gray-700">Description</th>
                            <th className="text-left p-2 font-medium text-gray-700 w-16">Qty</th>
                            <th className="text-left p-2 font-medium text-gray-700 w-16">M²</th>
                            <th className="text-left p-2 font-medium text-gray-700 w-20">UOM</th>
                            <th className="text-left p-2 font-medium text-gray-700 w-20">Weight</th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData.sheetList.map((item, index) => (
                            <tr key={index} className="border-t">
                              <td className="p-2">{item.description}</td>
                              <td className="p-2">{item.quantity}</td>
                              <td className="p-2">{item.m2 || '-'}</td>
                              <td className="p-2">{item.unit}</td>
                              <td className="p-2">{item.weight ? `${item.weight}kg` : '-'}</td>
                              <td className="p-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setFormData(prev => ({
                                      ...prev,
                                      sheetList: prev.sheetList.filter((_, i) => i !== index)
                                    }));
                                  }}
                                  className="text-red-600 hover:bg-red-50 h-7 w-7 p-0"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-100 border-t-2">
                          <tr>
                            <td className="p-2 font-semibold text-gray-700">Total</td>
                            <td className="p-2 font-semibold text-gray-900">
                              {formData.sheetList.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                            </td>
                            <td className="p-2 font-semibold text-gray-900">
                              {formData.sheetList.reduce((sum, item) => sum + (parseFloat(item.m2) || 0), 0).toFixed(2)}
                            </td>
                            <td className="p-2"></td>
                            <td className="p-2 font-semibold text-gray-900">
                              {formData.sheetList.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0).toFixed(1)}kg
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <Input
                      placeholder="Item description"
                      value={manualSheetEntry.description}
                      onChange={(e) => setManualSheetEntry(prev => ({ ...prev, description: e.target.value }))}
                      className="flex-1 min-w-[150px]"
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={manualSheetEntry.quantity}
                      onChange={(e) => setManualSheetEntry(prev => ({ ...prev, quantity: e.target.value }))}
                      className="w-16"
                    />
                    <Input
                      type="number"
                      placeholder="M²"
                      value={manualSheetEntry.m2}
                      onChange={(e) => setManualSheetEntry(prev => ({ ...prev, m2: e.target.value }))}
                      className="w-16"
                    />
                    <Input
                      placeholder="UOM"
                      value={manualSheetEntry.unit}
                      onChange={(e) => setManualSheetEntry(prev => ({ ...prev, unit: e.target.value }))}
                      className="w-20"
                    />
                    <Input
                      type="number"
                      placeholder="Weight"
                      value={manualSheetEntry.weight}
                      onChange={(e) => setManualSheetEntry(prev => ({ ...prev, weight: e.target.value }))}
                      className="w-20"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (manualSheetEntry.description && manualSheetEntry.quantity) {
                          setFormData(prev => ({
                            ...prev,
                            sheetList: [...prev.sheetList, {
                              description: manualSheetEntry.description,
                              quantity: Number(manualSheetEntry.quantity),
                              m2: manualSheetEntry.m2 ? Number(manualSheetEntry.m2) : null,
                              unit: manualSheetEntry.unit || 'sheets',
                              weight: manualSheetEntry.weight ? Number(manualSheetEntry.weight) : null
                            }]
                          }));
                          setManualSheetEntry({ description: '', quantity: '', m2: '', unit: 'sheets', weight: '' });
                        }
                      }}
                      disabled={!manualSheetEntry.description || !manualSheetEntry.quantity}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Additional Attachments</label>
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
                            Upload Additional Files
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

                {canScheduleDirectly && (
                  <div className="md:col-span-2 border-t pt-4 mt-2">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Schedule Directly (Optional)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label htmlFor="scheduleTruckId" className="block text-sm font-medium text-gray-700 mb-1">Truck</label>
                        <Select name="scheduleTruckId" onValueChange={(value) => handleSelectChange('scheduleTruckId', value)} value={formData.scheduleTruckId}>
                          <SelectTrigger id="scheduleTruckId"><SelectValue placeholder="Select truck..." /></SelectTrigger>
                          <SelectContent>
                            {TRUCKS.map(truck => <SelectItem key={truck.id} value={truck.id}>{truck.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label htmlFor="scheduleDate" className="block text-sm font-medium text-gray-700 mb-1">Schedule Date</label>
                        <Input id="scheduleDate" name="scheduleDate" type="date" value={formData.scheduleDate} onChange={handleChange} />
                      </div>
                      <div>
                        <label htmlFor="scheduleTimeSlot" className="block text-sm font-medium text-gray-700 mb-1">Time Slot</label>
                        <Select name="scheduleTimeSlot" onValueChange={(value) => handleSelectChange('scheduleTimeSlot', value)} value={formData.scheduleTimeSlot}>
                          <SelectTrigger id="scheduleTimeSlot"><SelectValue placeholder="Select slot..." /></SelectTrigger>
                          <SelectContent>
                            {DELIVERY_WINDOWS.map(window => <SelectItem key={window.id} value={window.id}>{window.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label htmlFor="scheduleSlotPosition" className="block text-sm font-medium text-gray-700 mb-1">Delivery Slot</label>
                        <Select name="scheduleSlotPosition" onValueChange={(value) => handleSelectChange('scheduleSlotPosition', value)} value={formData.scheduleSlotPosition || '1'}>
                          <SelectTrigger id="scheduleSlotPosition"><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Slot 1</SelectItem>
                            <SelectItem value="2">Slot 2</SelectItem>
                            <SelectItem value="3">Slot 3</SelectItem>
                            <SelectItem value="4">Slot 4</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={loading || uploadingAttachment}>
                {loading ? 'Creating...' : 'Create Job'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="text-lg">Confirm Job Details</DialogTitle>
          </DialogHeader>
          <p>Review and confirm job details before creating.</p>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setShowConfirmation(false)} disabled={loading}>
              Go Back
            </Button>
            <Button type="button" onClick={handleConfirmSubmit} disabled={loading}>
              {loading ? 'Creating...' : 'Confirm & Create Job'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}