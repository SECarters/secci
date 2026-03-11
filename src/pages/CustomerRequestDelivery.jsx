import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { useToast } from "@/components/ui/use-toast";
import { Upload, Loader2, X, Plus, Trash2, FileText, Sparkles } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { extractDeliveryData } from '@/functions/extractDeliveryData';


export default function CustomerRequestDeliveryPage() {
  const [deliveryTypes, setDeliveryTypes] = useState([]);
  const [pickupLocations, setPickupLocations] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [extractionDocument, setExtractionDocument] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [manualSheetEntry, setManualSheetEntry] = useState({ description: '', quantity: '', m2: '', unit: 'sheets', weight: '' });
  const [formData, setFormData] = useState({
    deliveryTypeId: '',
    pickupLocationId: '',
    deliveryLocation: '',
    deliveryLatitude: null,
    deliveryLongitude: null,
    customerReference: '',
    requestedDate: '',
    totalUnits: '',
    poSalesDocketNumber: '',
    deliveryWindow: '',
    sqm: '',
    weightKg: '',
    siteContactName: '',
    siteContactPhone: '',
    deliveryNotes: '',
    sheetList: [],
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
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      const [types, locations] = await Promise.all([
      base44.entities.DeliveryType.list(),
      base44.entities.PickupLocation.filter({ status: 'ACTIVE' })]
      );
      setDeliveryTypes(types);
      setPickupLocations(locations);
    };
    fetchData();
  }, []);

  const handleDocumentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a PDF or image file (JPG, PNG).",
        variant: "destructive"
      });
      e.target.value = '';
      return;
    }

    setExtractionDocument(file);
    setExtractedData(null);
    e.target.value = '';

    // Automatically start extraction
    setExtracting(true);
    try {
      toast({
        title: "Processing Document",
        description: "Uploading and analyzing your document with AI..."
      });

      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setAttachments((prev) => [...prev, file_url]);

      const response = await extractDeliveryData({ fileUrl: file_url });
      console.log('Extraction response:', response);

      // Handle both response.data and direct response formats
      const responseData = response.data || response;

      if (responseData?.success && responseData?.data) {
        const extracted = responseData.data;
        setExtractedData(extracted);

        const updates = {};

        if (extracted.supplier_name) {
          const matchedLocation = pickupLocations.find((loc) =>
          loc.name?.toLowerCase().includes(extracted.supplier_name.toLowerCase()) ||
          loc.company?.toLowerCase().includes(extracted.supplier_name.toLowerCase()) ||
          extracted.supplier_name.toLowerCase().includes(loc.name?.toLowerCase() || '') ||
          extracted.supplier_name.toLowerCase().includes(loc.company?.toLowerCase() || '')
          );
          if (matchedLocation) {
            updates.pickupLocationId = matchedLocation.id;
          }
        }

        if (extracted.delivery_address) {
          updates.deliveryLocation = extracted.delivery_address;
        }
        if (extracted.order_number) {
          updates.poSalesDocketNumber = extracted.order_number;
        }
        if (extracted.total_m2) {
          updates.sqm = String(extracted.total_m2);
        }
        if (extracted.total_weight) {
          updates.weightKg = String(extracted.total_weight);
        }
        if (extracted.site_contact) {
          updates.siteContactName = extracted.site_contact;
        }
        if (extracted.site_contact_phone) {
          updates.siteContactPhone = extracted.site_contact_phone;
        }
        if (extracted.delivery_notes) {
          updates.deliveryNotes = extracted.delivery_notes;
        }

        if (extracted.line_items && Array.isArray(extracted.line_items) && extracted.line_items.length > 0) {
          const sheetListItems = extracted.line_items.map((item) => ({
            description: item.product_description || item.product_code || '',
            quantity: item.quantity || 0,
            unit: item.unit || 'sheets',
            m2: item.m2 || null,
            weight: item.weight || null
          })).filter((item) => item.description);

          if (sheetListItems.length > 0) {
            updates.sheetList = sheetListItems;
          }
        }

        if (extracted.shipping_date) {
          try {
            const date = new Date(extracted.shipping_date);
            if (!isNaN(date.getTime())) {
              updates.requestedDate = format(date, 'yyyy-MM-dd');
            }
          } catch (e) {
            console.log('Could not parse date:', extracted.shipping_date);
          }
        }

        setFormData((prev) => ({
          ...prev,
          ...updates,
          sheetList: updates.sheetList || prev.sheetList
        }));

        toast({
          title: "Data Extracted Successfully!",
          description: "Please review the pre-filled information and make any necessary corrections."
        });
      } else {
        throw new Error('Failed to extract data from document');
      }

    } catch (error) {
      console.error('Document extraction error:', error);
      const errorMsg = error?.response?.data?.error || error?.response?.data?.details || error.message || "Could not extract data from the document.";
      toast({
        title: "Extraction Failed",
        description: errorMsg + " Please fill the form manually.",
        variant: "destructive"
      });
    } finally {
      setExtracting(false);
    }
  };

  const handleRemoveExtractionDocument = () => {
    setExtractionDocument(null);
    setExtractedData(null);
  };

  const handleAttachmentUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingAttachment(true);
    try {
      const uploadPromises = files.map((file) => base44.integrations.Core.UploadFile({ file }));
      const results = await Promise.all(uploadPromises);
      const fileUrls = results.map((r) => r.file_url);

      setAttachments((prev) => [...prev, ...fileUrls]);

      toast({
        title: "Files Uploaded",
        description: `${files.length} file(s) uploaded successfully.`
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload files. Please try again.",
        variant: "destructive"
      });
      console.error("Failed to upload attachments:", error);
    } finally {
      setUploadingAttachment(false);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (indexToRemove) => {
    setAttachments((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => {
      if (name.startsWith('nonStandardDelivery.')) {
        const nonStandardFieldName = name.split('.')[1];
        const updatedNonStandard = { ...prev.nonStandardDelivery };
        updatedNonStandard[nonStandardFieldName] = type === 'checkbox' ? checked : value;

        if (type === 'checkbox' && !checked) {
          if (nonStandardFieldName === 'longWalk') {
            updatedNonStandard.longWalkDistance = '';
          } else if (nonStandardFieldName === 'stairs') {
            updatedNonStandard.stairsCount = '';
          } else if (nonStandardFieldName === 'other') {
            updatedNonStandard.otherDetails = '';
          }
        }
        return {
          ...prev,
          nonStandardDelivery: updatedNonStandard
        };
      } else {
        const updated = {
          ...prev,
          [name]: type === 'checkbox' ? checked : value
        };

        if (name === 'sqm') {
          const sqmValue = parseFloat(value);
          if (!isNaN(sqmValue) && sqmValue >= 2000) {
            updated.nonStandardDelivery = {
              ...prev.nonStandardDelivery,
              moreThan2000Sqm: true,
              fourManNeeded: true
            };
          } else if (isNaN(sqmValue) || sqmValue < 2000) {
            updated.nonStandardDelivery = {
              ...prev.nonStandardDelivery,
              moreThan2000Sqm: false,
              fourManNeeded: false
            };
          }
        }

        return updated;
      }
    });
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const selectedDeliveryType = deliveryTypes.find((t) => t.id === formData.deliveryTypeId);
  const isUnitsDelivery = selectedDeliveryType?.name?.toLowerCase().includes('units');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      const selectedType = deliveryTypes.find((t) => t.id === formData.deliveryTypeId);
      const selectedLocation = pickupLocations.find((l) => l.id === formData.pickupLocationId);

      const hasNonStandard = Object.values(formData.nonStandardDelivery).some((val) =>
      typeof val === 'boolean' && val === true ||
      typeof val === 'string' && val.trim() !== ''
      );

      const newJob = await base44.entities.Job.create({
        customerId: currentUser.customerId,
        customerName: currentUser.customerName,
        customerReference: formData.customerReference || undefined,
        deliveryTypeId: formData.deliveryTypeId,
        deliveryTypeName: selectedType.name,
        pickupLocationId: formData.pickupLocationId,
        pickupLocation: selectedLocation ? `${selectedLocation.company} - ${selectedLocation.name}` : undefined,
        deliveryLocation: formData.deliveryLocation,
        deliveryLatitude: formData.deliveryLatitude,
        deliveryLongitude: formData.deliveryLongitude,
        requestedDate: formData.requestedDate,
        totalUnits: formData.totalUnits ? Number(formData.totalUnits) : undefined,
        poSalesDocketNumber: formData.poSalesDocketNumber || undefined,
        deliveryWindow: formData.deliveryWindow || undefined,
        sqm: formData.sqm ? Number(formData.sqm) : undefined,
        weightKg: formData.weightKg ? Number(formData.weightKg) : undefined,
        siteContactName: formData.siteContactName,
        siteContactPhone: formData.siteContactPhone,
        deliveryNotes: formData.deliveryNotes || undefined,
        sheetList: formData.sheetList.length > 0 ? formData.sheetList : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        status: 'PENDING_APPROVAL',
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

      toast({
        title: "Success!",
        description: "Your delivery request has been submitted and is ready for scheduling."
      });

      setFormData({
        deliveryTypeId: '', pickupLocationId: '', deliveryLocation: '',
        deliveryLatitude: null, deliveryLongitude: null,
        customerReference: '',
        requestedDate: '',
        totalUnits: '', poSalesDocketNumber: '', deliveryWindow: '',
        sqm: '', weightKg: '', siteContactName: '', siteContactPhone: '', deliveryNotes: '',
        sheetList: [],
        nonStandardDelivery: {
          longWalk: false, longWalkDistance: '', passUp: false, passDown: false, stairs: false,
          stairsCount: '', fourManNeeded: false, moreThan2000Sqm: false, zoneC: false, other: false,
          otherDetails: ''
        }
      });
      setAttachments([]);

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit request. Please try again.",
        variant: "destructive"
      });
      console.error("Failed to create job:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Request a New Delivery</h1>
      <p className="text-gray-600 mb-6">Fill out the details below to schedule a new plasterboard delivery.</p>
      
      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="p-6 space-y-6">

            {/* AI Document Extraction Section */}
            <div className="bg-gradient-to-r from-purple-50 via-blue-50 to-purple-50 border-2 border-purple-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-purple-900">Smart Document Extraction</h3>
              </div>
              <p className="text-sm text-purple-700 mb-3">Upload your docket/work order/sales order and let AI autofill this form for you.

              </p>
              <p className="text-xs text-purple-600 mb-3">
                Supported formats: PDF, JPG, PNG
              </p>
              
              {!extractionDocument ?
              <Button
                type="button"
                variant="outline"
                className="w-full border-purple-300 hover:bg-purple-50 hover:border-purple-400"
                disabled={extracting}
                asChild>
                
                  <label className="cursor-pointer">
                    <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleDocumentUpload}
                    className="hidden" />
                  
                    <FileText className="h-4 w-4 mr-2" />
                    Upload Document for AI Extraction
                  </label>
                </Button> :

              <div className="space-y-2">
                  <div className="flex items-center justify-between bg-white rounded p-3 border border-purple-200">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FileText className="h-4 w-4 text-purple-600 flex-shrink-0" />
                      <span className="text-sm text-gray-700 truncate">{extractionDocument.name}</span>
                    </div>
                    <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveExtractionDocument}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0">
                    
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {extracting &&
                <div className="flex items-center justify-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                      <span className="text-sm text-purple-700 font-medium">Extracting data with AI...</span>
                    </div>
                }
                  {extractedData &&
                <div className="flex items-start gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-green-600 text-lg">✓</div>
                      <div className="text-xs text-green-700 flex-1">
                        <span className="font-medium">Data extracted successfully!</span>
                        <br />
                        Review the pre-filled fields below and make any necessary adjustments.
                      </div>
                    </div>
                }
                </div>
              }
            </div>

            <div>
              <label htmlFor="deliveryLocation" className="block text-sm font-medium text-gray-700 mb-1">Delivery Address *</label>
              <Input
                id="deliveryLocation"
                name="deliveryLocation"
                value={formData.deliveryLocation}
                onChange={handleChange}
                placeholder="Enter delivery address"
                required />
              
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="deliveryTypeId" className="block text-sm font-medium text-gray-700 mb-1">Delivery Type *</label>
                <Select name="deliveryTypeId" onValueChange={(value) => handleSelectChange('deliveryTypeId', value)} value={formData.deliveryTypeId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select delivery type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryTypes.map((type) =>
                    <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {isUnitsDelivery &&
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Number of Units</label>
                  <Input name="totalUnits" type="number" value={formData.totalUnits} onChange={handleChange} placeholder="e.g., 150" />
                </div>
              }

              <div>
                <label htmlFor="pickupLocationId" className="block text-sm font-medium text-gray-700 mb-1">Pickup Location *</label>
                <Select name="pickupLocationId" onValueChange={(value) => handleSelectChange('pickupLocationId', value)} value={formData.pickupLocationId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select pickup location..." />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-[200px]">
                      {pickupLocations.map((location) =>
                      <SelectItem key={location.id} value={location.id}>
                          {location.company} - {location.name}
                        </SelectItem>
                      )}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>

              {formData.pickupLocationId &&
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PO/Sales/Docket Number</label>
                  <Input name="poSalesDocketNumber" value={formData.poSalesDocketNumber} onChange={handleChange} placeholder="e.g., PO12345 or DOC789" />
                </div>
              }
            </div>

          
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="requestedDate" className="block text-sm font-medium text-gray-700 mb-1">Requested Date *</label>
                <Input id="requestedDate" name="requestedDate" type="date" value={formData.requestedDate} onChange={handleChange} required />
              </div>

              {formData.requestedDate &&
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Window</label>
                  <Select name="deliveryWindow" onValueChange={(value) => handleSelectChange('deliveryWindow', value)} value={formData.deliveryWindow}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select delivery window..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="First AM (6-9am)">First AM (6-9am)</SelectItem>
                      <SelectItem value="Second AM (9am-12pm)">Second AM (9am-12pm)</SelectItem>
                      <SelectItem value="Lunch (12-3pm)">Lunch (12-3pm)</SelectItem>
                      <SelectItem value="Afternoon (3-6pm)">Afternoon (3-6pm)</SelectItem>
                      <SelectItem value="Any Time">Any Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              }

              <div>
                <label htmlFor="customerReference" className="block text-sm font-medium text-gray-700 mb-1">Customer Reference</label>
                <Input id="customerReference" name="customerReference" value={formData.customerReference} onChange={handleChange} />
             </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label htmlFor="sqm" className="block text-sm font-medium text-gray-700 mb-1">Total Square Meters (m²)</label>
                <Input id="sqm" name="sqm" type="number" value={formData.sqm} onChange={handleChange} placeholder="e.g., 850" />
              </div>
              <div>
                <label htmlFor="weightKg" className="block text-sm font-medium text-gray-700 mb-1">Total Weight (kg)</label>
                <Input id="weightKg" name="weightKg" type="number" value={formData.weightKg} onChange={handleChange} placeholder="e.g., 12000" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="siteContactName" className="block text-sm font-medium text-gray-700 mb-1">Site Contact Name *</label>
                <Input id="siteContactName" name="siteContactName" value={formData.siteContactName} onChange={handleChange} placeholder="e.g., John Smith" required />
              </div>

              <div>
                <label htmlFor="siteContactPhone" className="block text-sm font-medium text-gray-700 mb-1">Site Contact Phone *</label>
                <Input id="siteContactPhone" name="siteContactPhone" value={formData.siteContactPhone} onChange={handleChange} placeholder="e.g., 0412 345 678" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Non-Standard Delivery Requirements (Optional)</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="nonStandardDelivery.longWalk"
                    name="nonStandardDelivery.longWalk"
                    checked={formData.nonStandardDelivery.longWalk}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                  
                  <label htmlFor="nonStandardDelivery.longWalk" className="text-sm font-medium text-gray-700">
                    Long Walk
                  </label>
                </div>
                {formData.nonStandardDelivery.longWalk &&
                <Input
                  type="number"
                  name="nonStandardDelivery.longWalkDistance"
                  placeholder="Distance in meters"
                  value={formData.nonStandardDelivery.longWalkDistance}
                  onChange={handleChange}
                  className="col-span-1 sm:col-start-2" />

                }

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="nonStandardDelivery.passUp"
                    name="nonStandardDelivery.passUp"
                    checked={formData.nonStandardDelivery.passUp}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                  
                  <label htmlFor="nonStandardDelivery.passUp" className="text-sm font-medium text-gray-700">
                    Pass Up
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="nonStandardDelivery.passDown"
                    name="nonStandardDelivery.passDown"
                    checked={formData.nonStandardDelivery.passDown}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                  
                  <label htmlFor="nonStandardDelivery.passDown" className="text-sm font-medium text-gray-700">
                    Pass Down
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="nonStandardDelivery.stairs"
                    name="nonStandardDelivery.stairs"
                    checked={formData.nonStandardDelivery.stairs}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                  
                  <label htmlFor="nonStandardDelivery.stairs" className="text-sm font-medium text-gray-700">
                    Stairs
                  </label>
                </div>
                {formData.nonStandardDelivery.stairs &&
                <Input
                  type="number"
                  name="nonStandardDelivery.stairsCount"
                  placeholder="Number of stairs"
                  value={formData.nonStandardDelivery.stairsCount}
                  onChange={handleChange}
                  className="col-span-1 sm:col-start-2" />

                }

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="nonStandardDelivery.fourManNeeded"
                    name="nonStandardDelivery.fourManNeeded"
                    checked={formData.nonStandardDelivery.fourManNeeded}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                  
                  <label htmlFor="nonStandardDelivery.fourManNeeded" className="text-sm font-medium text-gray-700">
                    Four Man Needed
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="nonStandardDelivery.moreThan2000Sqm"
                    name="nonStandardDelivery.moreThan2000Sqm"
                    checked={formData.nonStandardDelivery.moreThan2000Sqm}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                  
                  <label htmlFor="nonStandardDelivery.moreThan2000Sqm" className="text-sm font-medium text-gray-700">
                    More than 2000m²
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="nonStandardDelivery.zoneC"
                    name="nonStandardDelivery.zoneC"
                    checked={formData.nonStandardDelivery.zoneC}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                  
                  <label htmlFor="nonStandardDelivery.zoneC" className="text-sm font-medium text-gray-700">
                    Zone C
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="nonStandardDelivery.other"
                    name="nonStandardDelivery.other"
                    checked={formData.nonStandardDelivery.other}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                  
                  <label htmlFor="nonStandardDelivery.other" className="text-sm font-medium text-gray-700">
                    Other (Please specify)
                  </label>
                </div>
                {formData.nonStandardDelivery.other &&
                <Textarea
                  name="nonStandardDelivery.otherDetails"
                  placeholder="Provide details for other non-standard requirements"
                  value={formData.nonStandardDelivery.otherDetails}
                  onChange={handleChange}
                  className="col-span-full sm:col-span-2" />

                }
              </div>
            </div>

            <div>
              <label htmlFor="deliveryNotes" className="block text-sm font-medium text-gray-700 mb-1">Delivery Notes</label>
              <Textarea id="deliveryNotes" name="deliveryNotes" value={formData.deliveryNotes} onChange={handleChange} placeholder="e.g., Site access via Gate 3. Call upon arrival." />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sheet List (Optional)</label>
              <p className="text-xs text-gray-500 mb-3">Add items from your work order/docket.</p>

              {formData.sheetList.length > 0 &&
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
                      {formData.sheetList.map((item, index) =>
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
                            setFormData((prev) => ({
                              ...prev,
                              sheetList: prev.sheetList.filter((_, i) => i !== index)
                            }));
                          }}
                          className="text-red-600 hover:bg-red-50 h-7 w-7 p-0">
                          
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                    )}
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
              }

              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Item description"
                  value={manualSheetEntry.description}
                  onChange={(e) => setManualSheetEntry((prev) => ({ ...prev, description: e.target.value }))}
                  className="flex-1 min-w-[150px]" />
                
                <Input
                  type="number"
                  placeholder="Qty"
                  value={manualSheetEntry.quantity}
                  onChange={(e) => setManualSheetEntry((prev) => ({ ...prev, quantity: e.target.value }))}
                  className="w-16" />
                
                <Input
                  type="number"
                  placeholder="M²"
                  value={manualSheetEntry.m2}
                  onChange={(e) => setManualSheetEntry((prev) => ({ ...prev, m2: e.target.value }))}
                  className="w-16" />
                
                <Input
                  placeholder="UOM"
                  value={manualSheetEntry.unit}
                  onChange={(e) => setManualSheetEntry((prev) => ({ ...prev, unit: e.target.value }))}
                  className="w-20" />
                
                <Input
                  type="number"
                  placeholder="Weight"
                  value={manualSheetEntry.weight}
                  onChange={(e) => setManualSheetEntry((prev) => ({ ...prev, weight: e.target.value }))}
                  className="w-20" />
                
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    if (manualSheetEntry.description && manualSheetEntry.quantity) {
                      setFormData((prev) => ({
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
                  disabled={!manualSheetEntry.description || !manualSheetEntry.quantity}>
                  
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Attachments (Optional)</label>
              <p className="text-xs text-gray-500 mb-2">Upload site plans, floor plans, or other relevant documents</p>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploadingAttachment}
                  asChild>
                  
                  <label className="cursor-pointer flex items-center justify-center h-10 px-4 py-2 text-sm font-medium transition-colors border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      multiple
                      onChange={handleAttachmentUpload}
                      className="hidden"
                      disabled={uploadingAttachment} />
                    
                    {uploadingAttachment ?
                    <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </> :

                    <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Files
                      </>
                    }
                  </label>
                </Button>
                
                {attachments.length > 0 &&
                <div className="space-y-2 mt-2">
                    {attachments.map((url, index) => {
                    const urlParts = url.split('/');
                    const fileNameWithExtension = urlParts[urlParts.length - 1];
                    const fileName = decodeURIComponent(fileNameWithExtension) || `File ${index + 1}`;
                    return (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                          <span className="text-sm text-gray-700 truncate flex-1">{fileName}</span>
                          <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAttachment(index)}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700 ml-2">
                          
                            Remove
                          </Button>
                        </div>);

                  })}
                  </div>
                }
              </div>
            </div>
          </CardContent>
          <CardFooter className="p-6">
            <Button type="submit" disabled={loading || uploadingAttachment} className="w-full md:w-auto">
              {loading ? 'Submitting...' : 'Submit Request'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>);

}