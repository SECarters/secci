import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Calendar,
  MapPin,
  User,
  Phone,
  FileText,
  Package,
  Clock,
  Truck,
  Edit,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Paperclip,
  XCircle,
  ArrowLeft,
  Navigation,
  Camera,
  Image as ImageIcon,
  X,
  ZoomIn, // Added
  Download, // Added
  Trash2, // Added
  Loader2 // Added for loading spinner
} from 'lucide-react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import ProofOfDeliveryUpload from './ProofOfDeliveryUpload';
import ScheduleJobDialog from './ScheduleJobDialog';
import ReturnJobDialog from './ReturnJobDialog';
import EditJobDialog from './EditJobDialog';
import JobActivityLog from './JobActivityLog';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export default function JobDetailsDialog({ job, open, onOpenChange, onJobUpdated }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [podDialogOpen, setPodDialogOpen] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null); // Added
  const [deletingPodIndex, setDeletingPodIndex] = useState(null); // Added
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch the specific job
  const { data: currentJob } = useQuery({
    queryKey: ['job', job?.id],
    queryFn: async () => {
      if (!job?.id) return null;
      const jobs = await base44.entities.Job.list();
      return jobs.find(j => j.id === job.id) || job;
    },
    enabled: !!job?.id && open,
    initialData: job,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments'],
    queryFn: () => base44.entities.Assignment.list(),
    enabled: open,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => base44.entities.Customer.list(),
    enabled: open,
    staleTime: 60000, // Cache for 1 minute as customer data changes less frequently
  });

  const { data: deliveryTypes = [] } = useQuery({
    queryKey: ['deliveryTypes'],
    queryFn: () => base44.entities.DeliveryType.list(),
    enabled: open,
    staleTime: 60000, // Cache for 1 minute
  });

  useEffect(() => {
    const fetchData = async () => {
      const user = await base44.auth.me();
      setCurrentUser(user);
    };

    if (open) {
      fetchData();
    }
  }, [open]);

  const handleApprove = async () => {
    try {
      await base44.entities.Job.update(currentJob.id, { ...currentJob, status: 'APPROVED' });
      await base44.entities.JobActivityLog.create({
        jobId: currentJob.id,
        customerId: currentJob.customerId,
        customerName: currentJob.customerName,
        activityType: 'approved',
        description: 'Job approved',
        userId: currentUser.id,
        userName: currentUser.full_name,
        userRole: currentUser.role === 'admin' ? 'admin' : currentUser.appRole,
        oldValue: 'PENDING_APPROVAL',
        newValue: 'APPROVED'
      });
      base44.functions.invoke('handleJobStatusChange', { jobId: currentJob.id, oldStatus: currentJob.status, newStatus: 'APPROVED' }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', currentJob.id] });
      toast({ title: "Job Approved", description: "The job has been approved and is ready for scheduling." });
      if (onJobUpdated) onJobUpdated();
    } catch (error) {
      toast({ title: "Error", description: "Failed to approve job. Please try again.", variant: "destructive" });
      console.error("Failed to approve job:", error);
    }
  };

  const handleCancel = async () => {
    try {
      await base44.entities.Job.update(currentJob.id, { ...currentJob, status: 'CANCELLED' });
      await base44.entities.JobActivityLog.create({
        jobId: currentJob.id,
        customerId: currentJob.customerId,
        customerName: currentJob.customerName,
        activityType: 'cancelled',
        description: 'Job cancelled',
        userId: currentUser.id,
        userName: currentUser.full_name,
        userRole: currentUser.role === 'admin' ? 'admin' : currentUser.appRole,
        oldValue: currentJob.status,
        newValue: 'CANCELLED'
      });
      base44.functions.invoke('handleJobStatusChange', { jobId: currentJob.id, oldStatus: currentJob.status, newStatus: 'CANCELLED' }).catch(console.error);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', currentJob.id] });
      toast({ title: "Job Cancelled", description: "The job has been cancelled." });
      if (onJobUpdated) onJobUpdated();
    } catch (error) {
      toast({ title: "Error", description: "Failed to cancel job. Please try again.", variant: "destructive" });
      console.error("Failed to cancel job:", error);
    }
  };

  const handleOpenNavigation = () => {
    if (!currentJob?.deliveryLocation) return;

    const address = encodeURIComponent(currentJob.deliveryLocation);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isIOS) {
        window.location.href = `maps://maps.apple.com/?q=${address}`;
      } else {
        window.location.href = `geo:0,0?q=${address}`;
      }
    } else {
      window.open(`https://www.google.com/maps/search/?api=1&query=${address}`, '_blank');
    }
  };

  const handleCapturePhoto = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingPhoto(true);
    try {
      const uploadPromises = files.map(file => base44.integrations.Core.UploadFile({ file }));
      const results = await Promise.all(uploadPromises);

      const newPhotos = results.map(r => ({
        url: r.file_url,
        caption: '',
        timestamp: new Date().toISOString(),
        uploadedBy: currentUser.email
      }));

      const existingPhotos = currentJob.jobPhotos || [];
      const updatedPhotos = [...existingPhotos, ...newPhotos];

      await base44.entities.Job.update(currentJob.id, {
        ...currentJob,
        jobPhotos: updatedPhotos
      });

      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', currentJob.id] });

      toast({
        title: "Photos Uploaded",
        description: `${files.length} photo(s) uploaded successfully.`,
      });

      if (onJobUpdated) {
        onJobUpdated();
      }
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload photos. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to upload photos:", error);
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleDeletePhoto = async (photoIndex) => {
    try {
      const existingPhotos = currentJob.jobPhotos || [];
      const updatedPhotos = existingPhotos.filter((_, index) => index !== photoIndex);

      await base44.entities.Job.update(currentJob.id, {
        ...currentJob,
        jobPhotos: updatedPhotos
      });

      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', currentJob.id] });

      toast({
        title: "Photo Deleted",
        description: "Photo removed successfully.",
      });

      if (onJobUpdated) {
        onJobUpdated();
      }
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete photo. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to delete photo:", error);
    }
  };

  // Added function to delete POD photo
  const handleDeletePodPhoto = async (podIndex) => {
    if (!window.confirm('Are you sure you want to delete this POD photo? This action cannot be undone.')) {
      return;
    }

    setDeletingPodIndex(podIndex);
    try {
      const existingPodFiles = currentJob.podFiles || [];
      const updatedPodFiles = existingPodFiles.filter((_, index) => index !== podIndex);

      await base44.entities.Job.update(currentJob.id, {
        ...currentJob,
        podFiles: updatedPodFiles
      });

      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', currentJob.id] });

      toast({
        title: "POD Photo Deleted",
        description: "Proof of delivery photo removed successfully.",
      });

      if (onJobUpdated) {
        onJobUpdated();
      }
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete POD photo. Please try again.",
        variant: "destructive",
      });
      console.error("Failed to delete POD photo:", error);
    } finally {
      setDeletingPodIndex(null);
    }
  };

  // Added function to download image
  const handleDownloadImage = (url, filename) => {
    fetch(url)
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'image.jpg';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      })
      .catch(error => {
        console.error('Download failed:', error);
        toast({
          title: "Download Failed",
          description: "Failed to download image. Please try again.",
          variant: "destructive",
        });
      });
  };

  const getStatusColor = (status) => {
    const colors = {
      PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-blue-100 text-blue-800',
      SCHEDULED: 'bg-indigo-100 text-indigo-800',
      IN_TRANSIT: 'bg-purple-100 text-purple-800',
      DELIVERED: 'bg-green-100 text-green-800',
      RETURNED: 'bg-black text-white',
      CANCELLED: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (!currentJob || !currentUser) return null;

  const assignment = assignments?.find(a => a.jobId === currentJob.id);
  const customer = customers?.find(c => c.id === currentJob.customerId);
  const deliveryType = deliveryTypes?.find(dt => dt.id === currentJob.deliveryTypeId);

  const isDriver = currentUser?.appRole === 'driver';
  const isCustomer = currentUser?.role !== 'admin' && currentUser?.appRole !== 'dispatcher';
  const canEdit = currentUser?.role === 'admin' || currentUser?.appRole === 'dispatcher';
  const canUploadPOD = (isDriver || canEdit) && (currentJob.status === 'SCHEDULED' || currentJob.status === 'DELIVERED');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span className="text-base sm:text-lg">Job Details</span>
              <Badge className={getStatusColor(currentJob.status)}>
                {currentJob.status.replace(/_/g, ' ')}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details" className="text-xs sm:text-sm">Details</TabsTrigger>
              {/* Updated Trigger for Delivery POD */}
              <TabsTrigger value="delivery" className="text-xs sm:text-sm">
                <span className="hidden sm:inline">Delivery POD</span>
                <span className="sm:hidden">POD</span>
                <span className="ml-1">({(currentJob.podFiles || []).length})</span>
              </TabsTrigger>
              <TabsTrigger value="photos" className="text-xs sm:text-sm">
                <span className="hidden sm:inline">Extra Photos</span>
                <span className="sm:hidden">Photos</span>
                <span className="ml-1">({(currentJob.jobPhotos || []).length})</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              {isDriver && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-3 sm:p-4">
                    <Button
                      onClick={handleOpenNavigation}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base"
                    >
                      <Navigation className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                      Navigate to Delivery Location
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-wrap gap-2">
                    {canEdit && currentJob.status === 'PENDING_APPROVAL' && (
                      <Button onClick={handleApprove} size="sm" className="bg-green-600 hover:bg-green-700 text-xs sm:text-sm">
                        <CheckCircle2 className="h-4 w-4 mr-1 sm:mr-2" />
                        Approve Job
                      </Button>
                    )}

                    {canEdit && (currentJob.status === 'APPROVED' || currentJob.status === 'PENDING_APPROVAL') && (
                      <Button onClick={() => setScheduleDialogOpen(true)} size="sm" variant="outline" className="text-xs sm:text-sm">
                        <Calendar className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Schedule</span>
                      </Button>
                    )}

                    {canEdit && (
                      <Button onClick={() => setEditDialogOpen(true)} size="sm" variant="outline" className="text-xs sm:text-sm">
                        <Edit className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                    )}

                    {isDriver && currentJob.status === 'SCHEDULED' && (
                      <>
                        <Button onClick={() => setPodDialogOpen(true)} size="sm" className="bg-green-600 hover:bg-green-700 text-xs sm:text-sm">
                          <Upload className="h-4 w-4 mr-1 sm:mr-2" />
                          <span className="hidden sm:inline">Upload POD</span>
                          <span className="sm:hidden">POD</span>
                        </Button>
                        <Button onClick={() => setReturnDialogOpen(true)} size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 text-xs sm:text-sm">
                          <ArrowLeft className="h-4 w-4 mr-1 sm:mr-2" />
                          <span className="hidden sm:inline">Return Job</span>
                          <span className="sm:hidden">Return</span>
                        </Button>
                      </>
                    )}

                    {canEdit && (currentJob.status === 'SCHEDULED' || currentJob.status === 'DELIVERED') && (
                      <Button
                        onClick={async () => {
                          try {
                            const newStatus = currentJob.status === 'DELIVERED' ? 'SCHEDULED' : 'DELIVERED';
                            const updatePayload = { ...currentJob, status: newStatus };
                            if (newStatus === 'DELIVERED') updatePayload.deliveredAt = new Date().toISOString();
                            await base44.entities.Job.update(currentJob.id, updatePayload);
                            if (newStatus === 'DELIVERED' || newStatus === 'SCHEDULED') {
                              base44.functions.invoke('handleJobStatusChange', { jobId: currentJob.id, oldStatus: currentJob.status, newStatus }).catch(console.error);
                            }

                            // Log status change
                            await base44.entities.JobActivityLog.create({
                              jobId: currentJob.id,
                              customerId: currentJob.customerId,
                              customerName: currentJob.customerName,
                              activityType: newStatus === 'DELIVERED' ? 'delivered' : 'status_changed',
                              description: newStatus === 'DELIVERED' ? 'Job marked as delivered' : 'Job reverted to scheduled',
                              userId: currentUser.id,
                              userName: currentUser.full_name,
                              userRole: currentUser.role === 'admin' ? 'admin' : currentUser.appRole,
                              oldValue: currentJob.status,
                              newValue: newStatus
                            });

                            queryClient.invalidateQueries({ queryKey: ['jobs'] });
                            queryClient.invalidateQueries({ queryKey: ['job', currentJob.id] });

                            toast({
                              title: newStatus === 'DELIVERED' ? "Job Completed" : "Job Reverted",
                              description: newStatus === 'DELIVERED' 
                                ? "Job marked as delivered successfully." 
                                : "Job reverted to scheduled status.",
                            });

                            if (onJobUpdated) {
                              onJobUpdated();
                            }
                          } catch (error) {
                            toast({
                              title: "Error",
                              description: "Failed to update job status. Please try again.",
                              variant: "destructive",
                            });
                          }
                        }}
                        size="sm" 
                        className={`text-xs sm:text-sm ${currentJob.status === 'DELIVERED' 
                          ? "bg-orange-600 hover:bg-orange-700" 
                          : "bg-green-600 hover:bg-green-700"}`}
                        >
                        {currentJob.status === 'DELIVERED' ? (
                          <>
                            <XCircle className="h-4 w-4 mr-1 sm:mr-2" />
                            <span className="hidden sm:inline">Revert to Scheduled</span>
                            <span className="sm:hidden">Revert</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-1 sm:mr-2" />
                            <span className="hidden sm:inline">Complete Delivery</span>
                            <span className="sm:hidden">Complete</span>
                          </>
                        )}
                        </Button>
                        )}

                        {canEdit && currentJob.status !== 'CANCELLED' && currentJob.status !== 'DELIVERED' && (
                        <Button onClick={handleCancel} size="sm" variant="destructive" className="text-xs sm:text-sm">
                        <XCircle className="h-4 w-4 mr-1 sm:mr-2" />
                        Cancel
                        </Button>
                        )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold text-lg mb-3">Customer Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Customer</p>
                      <p className="font-medium">{currentJob.customerName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Delivery Type</p>
                      <p className="font-medium">{currentJob.deliveryTypeName}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold text-lg mb-3">Delivery Details</h3>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-600">Delivery Location</p>
                        <p className="font-medium">{currentJob.deliveryLocation}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Package className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-600">Pickup Location</p>
                        <p className="font-medium">{currentJob.pickupLocation}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-600">Requested Date</p>
                          <p className="font-medium">{format(new Date(currentJob.requestedDate), 'MMM dd, yyyy')}</p>
                        </div>
                      </div>

                      {assignment && (
                        <div className="flex items-start gap-3">
                          <Truck className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-gray-600">Assigned Truck</p>
                            <p className="font-medium">{assignment.truckId}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {currentJob.deliveryWindow && (
                      <div className="flex items-start gap-3">
                        <Clock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-gray-600">Delivery Window</p>
                          <p className="font-medium">{currentJob.deliveryWindow}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold text-lg mb-3">Site Contact</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <User className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-600">Contact Name</p>
                        <p className="font-medium">{currentJob.siteContactName}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Phone className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-600">Contact Phone</p>
                        <a href={`tel:${currentJob.siteContactPhone}`} className="font-medium text-blue-600 hover:underline">
                          {currentJob.siteContactPhone}
                        </a>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 space-y-3">
                  <h3 className="font-semibold text-lg mb-3">Job Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {currentJob.sqm && (
                      <div>
                        <p className="text-sm text-gray-600">SQM</p>
                        <p className="font-medium">{currentJob.sqm.toLocaleString()}</p>
                      </div>
                    )}
                    {currentJob.weightKg && (
                      <div>
                        <p className="text-sm text-gray-600">Weight (kg)</p>
                        <p className="font-medium">{currentJob.weightKg.toLocaleString()}</p>
                      </div>
                    )}
                    {currentJob.totalUnits && (
                      <div>
                        <p className="text-sm text-gray-600">Total Units</p>
                        <p className="font-medium">{currentJob.totalUnits}</p>
                      </div>
                    )}
                    {currentJob.poSalesDocketNumber && (
                      <div>
                        <p className="text-sm text-gray-600">PO/Docket Number</p>
                        <p className="font-medium">{currentJob.poSalesDocketNumber}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {currentJob.deliveryNotes && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-3">Delivery Notes</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{currentJob.deliveryNotes}</p>
                  </CardContent>
                </Card>
              )}

              {currentJob.sheetList && currentJob.sheetList.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-3">Sheet List</h3>
                    <div className="border rounded-lg overflow-hidden overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-3 font-medium text-gray-700">Description</th>
                            <th className="text-left p-3 font-medium text-gray-700 w-16">Qty</th>
                            <th className="text-left p-3 font-medium text-gray-700 w-16">M²</th>
                            <th className="text-left p-3 font-medium text-gray-700 w-20">UOM</th>
                            <th className="text-left p-3 font-medium text-gray-700 w-20">Weight</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentJob.sheetList.map((item, index) => (
                            <tr key={index} className="border-t hover:bg-gray-50">
                              <td className="p-3">{item.description}</td>
                              <td className="p-3 font-medium">{item.quantity}</td>
                              <td className="p-3">{item.m2 || '-'}</td>
                              <td className="p-3 text-gray-600">{item.unit}</td>
                              <td className="p-3">{item.weight ? `${item.weight}kg` : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-100 border-t-2">
                          <tr>
                            <td className="p-3 font-semibold text-gray-700">Total</td>
                            <td className="p-3 font-bold text-gray-900">
                              {currentJob.sheetList.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                            </td>
                            <td className="p-3 font-bold text-gray-900">
                              {currentJob.sheetList.reduce((sum, item) => sum + (parseFloat(item.m2) || 0), 0).toFixed(2)}
                            </td>
                            <td className="p-3"></td>
                            <td className="p-3 font-bold text-gray-900">
                              {currentJob.sheetList.reduce((sum, item) => sum + (parseFloat(item.weight) || 0), 0).toFixed(1)}kg
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {currentJob.nonStandardDelivery && Object.values(currentJob.nonStandardDelivery).some(v => v) && (
                <Card className="border-orange-200 bg-orange-50">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-orange-900">
                      <AlertTriangle className="h-5 w-5" />
                      Non-Standard Delivery Requirements
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {currentJob.nonStandardDelivery.longWalk && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-orange-600" />
                          <span>Long Walk ({currentJob.nonStandardDelivery.longWalkDistance}m)</span>
                        </div>
                      )}
                      {currentJob.nonStandardDelivery.passUp && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-orange-600" />
                          <span>Pass Up Required</span>
                        </div>
                      )}
                      {currentJob.nonStandardDelivery.passDown && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-orange-600" />
                          <span>Pass Down Required</span>
                        </div>
                      )}
                      {currentJob.nonStandardDelivery.stairs && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-orange-600" />
                          <span>Stairs ({currentJob.nonStandardDelivery.stairsCount})</span>
                        </div>
                      )}
                      {currentJob.nonStandardDelivery.fourManNeeded && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-orange-600" />
                          <span>4 Man Crew Needed</span>
                        </div>
                      )}
                      {currentJob.nonStandardDelivery.moreThan2000Sqm && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-orange-600" />
                          <span>More than 2000m²</span>
                        </div>
                      )}
                      {currentJob.nonStandardDelivery.zoneC && (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-orange-600" />
                          <span>Zone C</span>
                        </div>
                      )}
                      {currentJob.nonStandardDelivery.other && (
                        <div className="flex items-start gap-2 md:col-span-2">
                          <CheckCircle2 className="h-4 w-4 text-orange-600 mt-0.5" />
                          <span>Other: {currentJob.nonStandardDelivery.otherDetails}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {currentJob.attachments && currentJob.attachments.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <Paperclip className="h-5 w-5" />
                      Attachments
                    </h3>
                    <div className="space-y-2">
                      {currentJob.attachments.map((url, index) => (
                        <a
                          key={index}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-blue-600 hover:underline text-sm"
                        >
                          <Paperclip className="h-4 w-4" />
                          Attachment {index + 1}
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {currentJob.isReturned && (
                <Card className="border-gray-900 bg-gray-900">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-white">
                      <ArrowLeft className="h-5 w-5" />
                      Job Returned
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <p className="text-gray-400">Reason</p>
                        <p className="font-medium text-white">{currentJob.returnReason}</p>
                      </div>
                      {currentJob.returnPhotos && currentJob.returnPhotos.length > 0 && (
                        <div>
                          <p className="text-gray-400 mb-2">Site Photos</p>
                          <div className="grid grid-cols-4 gap-2">
                            {currentJob.returnPhotos.map((photo, index) => (
                              <img
                                key={index}
                                src={photo}
                                alt={`Return photo ${index + 1}`}
                                className="w-full aspect-square object-cover rounded cursor-pointer hover:opacity-80"
                                onClick={() => setFullScreenImage(photo)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-gray-400">Returned By</p>
                          <p className="font-medium text-white">{currentJob.returnedByName || currentJob.returnedBy}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Truck</p>
                          <p className="font-medium text-white">{currentJob.returnedTruckId || 'N/A'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-gray-400">Returned Date</p>
                        <p className="font-medium text-white">{currentJob.returnedDate ? format(new Date(currentJob.returnedDate), 'MMM dd, yyyy HH:mm') : 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-3">Activity Log</h3>
                  <JobActivityLog jobId={currentJob.id} />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Updated Delivery Tab Content */}
            <TabsContent value="delivery" className="space-y-4 mt-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg">Proof of Delivery Photos</h3> {/* Changed title */}
                    {canUploadPOD && (
                      <Button
                        onClick={() => setPodDialogOpen(true)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Add More Photos {/* Changed button text */}
                      </Button>
                    )}
                  </div>

                  {currentJob.podFiles && currentJob.podFiles.length > 0 ? (
                  <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-4">
                        {currentJob.podFiles.map((url, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={url}
                              alt={`POD ${index + 1}`}
                              loading="lazy"
                              className="w-full aspect-square object-cover rounded-lg border-2 border-green-200 cursor-pointer hover:border-green-400 transition-colors"
                              onClick={() => setFullScreenImage(url)} // Changed to open full screen
                            />
                            <Badge className="absolute top-2 left-2 bg-green-600">
                              POD {index + 1}
                            </Badge>

                            {/* Action Buttons for POD - Always visible on mobile */}
                            <div className="absolute top-1 right-1 sm:top-2 sm:right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <Button
                                size="icon"
                                variant="secondary"
                                className="h-6 w-6 sm:h-7 sm:w-7 bg-white/90 hover:bg-white"
                                onClick={() => setFullScreenImage(url)}
                                aria-label="View full size"
                              >
                                <ZoomIn className="h-3 w-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="secondary"
                                className="h-6 w-6 sm:h-7 sm:w-7 bg-white/90 hover:bg-white"
                                onClick={() => handleDownloadImage(url, `POD-${currentJob.id}-${index + 1}.jpg`)}
                                aria-label="Download image"
                              >
                                <Download className="h-3 w-3" />
                              </Button>
                              {canEdit && (
                                <Button
                                  size="icon"
                                  variant="destructive"
                                  className="h-6 w-6 sm:h-7 sm:w-7"
                                  onClick={() => handleDeletePodPhoto(index)}
                                  disabled={deletingPodIndex === index}
                                  aria-label="Delete POD photo"
                                >
                                  {deletingPodIndex === index ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {currentJob.podNotes && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm font-medium text-gray-700 mb-2">Delivery Notes:</p>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{currentJob.podNotes}</p>
                        </div>
                      )}

                      <div className="text-sm text-gray-500">
                        <p>Status: <Badge className="bg-green-600">Delivered</Badge></p>
                        <p className="mt-1">Total Photos: {currentJob.podFiles.length}</p> {/* Added total photos */}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Upload className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No POD uploaded yet</p>
                      <p className="text-sm mt-1">Upload proof of delivery to complete this job</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Updated Photos Tab Content */}
            <TabsContent value="photos" className="space-y-4 mt-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg">Extra Photos</h3>
                    <Button
                      size="sm"
                      disabled={uploadingPhoto}
                      asChild
                    >
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*,video/*"
                          multiple
                          capture="environment"
                          onChange={handleCapturePhoto}
                          className="hidden"
                          disabled={uploadingPhoto}
                        />
                        {uploadingPhoto ? (
                          <>
                            <Upload className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Camera className="h-4 w-4 mr-2" />
                            Add Photos
                          </>
                        )}
                      </label>
                    </Button>
                  </div>

                  {(!currentJob.jobPhotos || currentJob.jobPhotos.length === 0) ? (
                    <div className="text-center py-12 text-gray-500">
                      <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No extra photos uploaded yet</p>
                      <p className="text-sm mt-1">Long walk, bad or unsafe access, other non-standard delivery</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
                      {currentJob.jobPhotos.map((photo, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={photo.url}
                            alt={`Job photo ${index + 1}`}
                            loading="lazy"
                            className="w-full aspect-square object-cover rounded-lg border-2 border-gray-200 cursor-pointer hover:border-blue-400 transition-colors"
                            onClick={() => setFullScreenImage(photo.url)} // Changed to open full screen
                          />

                          {/* Action Buttons for Extra Photos - Always visible on mobile */}
                          <div className="absolute top-1 right-1 sm:top-2 sm:right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-6 w-6 sm:h-7 sm:w-7 bg-white/90 hover:bg-white"
                              onClick={() => setFullScreenImage(photo.url)}
                              aria-label="View full size"
                            >
                              <ZoomIn className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-6 w-6 sm:h-7 sm:w-7 bg-white/90 hover:bg-white"
                              onClick={() => handleDownloadImage(photo.url, `Extra-${currentJob.id}-${index + 1}.jpg`)}
                              aria-label="Download image"
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                            {canEdit && (
                              <Button
                                size="icon"
                                variant="destructive"
                                className="h-6 w-6 sm:h-7 sm:w-7"
                                onClick={() => handleDeletePhoto(index)}
                                aria-label="Delete photo"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>

                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-xs p-2 rounded-b-lg">
                            <p className="truncate">{format(new Date(photo.timestamp), 'MMM dd, HH:mm')}</p>
                            <p className="truncate text-gray-300">{photo.uploadedBy}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-gray-500 mt-4">
                    <strong>Tip:</strong> Document long walks, unsafe access, difficult site conditions, and other non-standard delivery issues. Click on any photo to view full size.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>

        <ScheduleJobDialog
          job={currentJob}
          open={scheduleDialogOpen}
          onOpenChange={setScheduleDialogOpen}
          onJobScheduled={() => {
            setScheduleDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['job', currentJob.id] });
            if (onJobUpdated) {
              onJobUpdated();
            }
          }}
        />

        <EditJobDialog
          job={currentJob}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onJobUpdated={() => {
            setEditDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['job', currentJob.id] });
            if (onJobUpdated) {
              onJobUpdated();
            }
          }}
        />

        <ReturnJobDialog
          job={currentJob}
          assignment={assignment}
          open={returnDialogOpen}
          onOpenChange={setReturnDialogOpen}
          onComplete={() => {
            setReturnDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['job', currentJob.id] });
            if (onJobUpdated) {
              onJobUpdated();
            }
          }}
        />

        <ProofOfDeliveryUpload
          job={currentJob}
          open={podDialogOpen}
          onOpenChange={setPodDialogOpen}
          onPODUploaded={() => {
            setPodDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            queryClient.invalidateQueries({ queryKey: ['job', currentJob.id] });
            if (onJobUpdated) {
              onJobUpdated();
            }
          }}
        />
      </Dialog>

      {/* Full Screen Image Viewer - Added */}
      {fullScreenImage && (
        <Dialog open={!!fullScreenImage} onOpenChange={() => setFullScreenImage(null)}>
          <DialogContent className="max-w-6xl w-[98vw] sm:w-full max-h-[98vh] p-1 sm:p-2">
            <div className="relative">
              <img
                src={fullScreenImage}
                alt="Full size"
                loading="lazy"
                className="w-full h-auto max-h-[92vh] object-contain rounded-lg"
              />
              <Button
                size="icon"
                variant="secondary"
                className="absolute top-1 right-1 sm:top-2 sm:right-2 h-8 w-8 sm:h-10 sm:w-10 bg-white/90 hover:bg-white"
                onClick={() => setFullScreenImage(null)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="absolute bottom-1 right-1 sm:bottom-2 sm:right-2 bg-white/90 hover:bg-white text-xs sm:text-sm"
                onClick={() => handleDownloadImage(fullScreenImage, 'delivery-photo.jpg')}
                aria-label="Download image"
              >
                <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}