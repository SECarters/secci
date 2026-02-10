import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { base44 } from '@/api/base44Client';
import { useToast } from "@/components/ui/use-toast";
import { Upload, Loader2, X, Camera, Image as ImageIcon, AlertCircle, CheckCircle2, WifiOff } from 'lucide-react';
import { sendPODNotesNotification } from '@/functions/sendPODNotesNotification';
import { useOffline } from '../offline/OfflineManager';

const MAX_PHOTOS = 20;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB before compression
const TARGET_SIZE = 2 * 1024 * 1024; // 2MB target after compression

const compressImage = async (file) => {
  return new Promise((resolve, reject) => {
    // Set a timeout to prevent hanging
    const timeout = setTimeout(() => {
      console.warn('Compression timeout - returning original file');
      resolve(file); // Return original file instead of rejecting
    }, 30000); // 30 second timeout

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions (max 1920px width/height)
          const maxDimension = 1920;
          if (width > height && width > maxDimension) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          } else if (height > maxDimension) {
            width = (width * maxDimension) / height;
            height = maxDimension;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            clearTimeout(timeout);
            console.warn('Failed to get canvas context - returning original file');
            resolve(file); // Return original file
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          // Try different quality levels to reach target size
          let quality = 0.8;
          const tryCompress = () => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  clearTimeout(timeout);
                  console.warn('Compression failed - no blob created, returning original file');
                  resolve(file); // Return original file
                  return;
                }

                // Only reduce quality if blob size is still too big AND quality is above threshold
                if (blob.size > TARGET_SIZE && quality > 0.5) { 
                  quality -= 0.1;
                  tryCompress();
                } else {
                  clearTimeout(timeout);
                  const compressedFile = new File([blob], file.name || 'photo.jpg', {
                    type: 'image/jpeg',
                    lastModified: Date.now(),
                  });
                  resolve(compressedFile);
                }
              },
              'image/jpeg',
              quality
            );
          };

          tryCompress();
        } catch (err) {
          clearTimeout(timeout);
          console.warn('Compression error - returning original file:', err);
          resolve(file); // Return original file instead of rejecting
        }
      };
      img.onerror = () => {
        clearTimeout(timeout);
        console.warn('Failed to load image - returning original file');
        resolve(file); // Return original file instead of rejecting
      };
    };
    reader.onerror = () => {
      clearTimeout(timeout);
      console.warn('Failed to read file - returning original file');
      resolve(file); // Return original file instead of rejecting
    };
  });
};

export default function ProofOfDeliveryUpload({ job, open, onOpenChange, onPODUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [notes, setNotes] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingIndex, setProcessingIndex] = useState(-1);
  const [errors, setErrors] = useState([]);
  const { toast } = useToast();
  const { isOnline, queuePODUpload } = useOffline();

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    if (selectedFiles.length === 0) return;

    // Validate total count
    if (photos.length + selectedFiles.length > MAX_PHOTOS) {
      toast({
        title: "Too Many Photos",
        description: `You can upload a maximum of ${MAX_PHOTOS} photos. Currently you have ${photos.length} photo(s).`,
        variant: "destructive",
      });
      e.target.value = '';
      return;
    }

    // Validate file types and sizes
    const validFiles = [];
    const newErrors = [];

    for (const file of selectedFiles) {
      if (!file.type.startsWith('image/')) {
        newErrors.push(`${file.name}: Not an image file`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        newErrors.push(`${file.name}: File too large (max 10MB)`);
        continue;
      }

      validFiles.push(file);
    }

    if (newErrors.length > 0) {
      setErrors(prev => [...prev, ...newErrors]);
      base44.analytics.track({
        eventName: 'pod_photo_validation_failed',
        properties: { error_count: newErrors.length, job_id: job.id }
      });
    }

    if (validFiles.length === 0) {
      e.target.value = '';
      return;
    }

    // Create previews
    const newPreviews = await Promise.all(
      validFiles.map(file => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve({
            file,
            preview: e.target.result,
            compressed: false,
            originalSize: file.size,
          });
          reader.readAsDataURL(file);
        });
      })
    );

    setPhotos(prev => [...prev, ...validFiles]);
    setPhotoPreviews(prev => [...prev, ...newPreviews]);
    e.target.value = '';

    toast({
      title: "Photos Added",
      description: `${validFiles.length} photo(s) added. Ready to upload.`,
    });
  };

  const handleRemovePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
    setErrors(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (photos.length === 0) {
      toast({
        title: "No Photos",
        description: "Please add at least one photo of the delivery.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setErrors([]);

    const user = await base44.auth.me(); 

    try {
      const totalPhotos = photos.length;
      const compressedPhotosDataURLs = [];
      const currentSubmissionErrors = [];

      // PHASE 1: Compress and convert photos to Data URLs
      for (let i = 0; i < photos.length; i++) {
        setProcessingIndex(i);
        const photo = photos[i];
        const photoName = photo.name || `photo-${i + 1}.jpg`;

        try {
          let fileToProcess = photo;
          
          // Only compress if file is larger than target and is an image
          if (photo.type && photo.type.startsWith('image/') && photo.size > TARGET_SIZE) {
            fileToProcess = await compressImage(photo);
            console.log(`Processed ${photoName}: ${(photo.size / 1024 / 1024).toFixed(2)}MB → ${(fileToProcess.size / 1024 / 1024).toFixed(2)}MB`);
          }

          // Convert to data URL with timeout protection
          const dataURL = await new Promise((resolve, reject) => {
            const readTimeout = setTimeout(() => {
              // On timeout, try one more time with original file
              console.warn(`Read timeout for ${photoName}, retrying with original...`);
              const retryReader = new FileReader();
              retryReader.onload = (e) => {
                if (e.target.result) {
                  resolve(e.target.result);
                } else {
                  reject(new Error('Empty file result on retry'));
                }
              };
              retryReader.onerror = () => reject(new Error('File read error on retry'));
              retryReader.readAsDataURL(photo); // Use original photo
            }, 20000); // 20 second timeout for reading

            const reader = new FileReader();
            reader.onload = (e) => {
              clearTimeout(readTimeout);
              if (e.target.result) {
                resolve(e.target.result);
              } else {
                // Try with original file if result is empty
                console.warn(`Empty result for ${photoName}, trying original...`);
                const fallbackReader = new FileReader();
                fallbackReader.onload = (e2) => resolve(e2.target.result);
                fallbackReader.onerror = () => reject(new Error('Empty file result'));
                fallbackReader.readAsDataURL(photo);
              }
            };
            reader.onerror = (e) => {
              clearTimeout(readTimeout);
              // Try with original file on error
              console.warn(`Read error for ${photoName}, trying original...`);
              const fallbackReader = new FileReader();
              fallbackReader.onload = (e2) => resolve(e2.target.result);
              fallbackReader.onerror = () => reject(new Error('File read error'));
              fallbackReader.readAsDataURL(photo);
            };
            reader.readAsDataURL(fileToProcess);
          });
          
          compressedPhotosDataURLs.push(dataURL);
          
          const progress = ((i + 1) / totalPhotos) * 50;
          setUploadProgress(Math.round(progress));
        } catch (error) {
          console.error(`Failed to prepare photo ${i + 1} (${photoName}):`, error);
          currentSubmissionErrors.push(`Photo ${i + 1} (${photoName}): ${error.message || 'Processing failed'}`);
          base44.analytics.track({
            eventName: 'pod_photo_processing_failed',
            properties: { photo_index: i + 1, job_id: job.id, error: error.message }
          });
        }
      }

      setProcessingIndex(-1);

      if (compressedPhotosDataURLs.length === 0) {
        // Last resort: try uploading original files directly and skip Phase 2
        console.log('All processing failed, attempting direct upload of original files...');
        setUploadProgress(50); // Show some progress
        const directUploadUrls = [];
        const directUploadErrors = [];
        
        // Try uploading one photo at a time with retry logic
        for (let i = 0; i < photos.length; i++) {
          let uploadSuccess = false;
          let retryCount = 0;
          const maxRetries = 2;
          
          while (!uploadSuccess && retryCount <= maxRetries) {
            try {
              setProcessingIndex(i);
              const photo = photos[i];
              
              // Validate photo before upload
              if (!photo || !photo.type || !photo.type.startsWith('image/')) {
                throw new Error('Invalid image file');
              }
              
              console.log(`Attempt ${retryCount + 1} - Uploading photo ${i + 1}:`, photo.name, photo.type, (photo.size / 1024).toFixed(0) + 'KB');
              
              // Add timeout to the upload request
              const uploadPromise = base44.integrations.Core.UploadFile({ file: photo });
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Upload timeout - server took too long to respond')), 60000)
              );
              
              const result = await Promise.race([uploadPromise, timeoutPromise]);
              
              if (!result || !result.file_url) {
                throw new Error('Upload returned no URL');
              }
              
              directUploadUrls.push(result.file_url);
              console.log(`Successfully uploaded photo ${i + 1}:`, result.file_url);
              uploadSuccess = true;
              
              const progress = 50 + ((i + 1) / photos.length) * 50;
              setUploadProgress(Math.round(progress));
            } catch (directErr) {
              retryCount++;
              const errorMsg = directErr?.message || String(directErr);
              console.error(`Direct upload attempt ${retryCount} failed for photo ${i + 1}:`, errorMsg);
              
              if (retryCount > maxRetries) {
                directUploadErrors.push(`Photo ${i + 1} (${photos[i]?.name || 'N/A'}): ${errorMsg}`);
                base44.analytics.track({
                  eventName: 'pod_api_upload_failed',
                  properties: { 
                    photo_index: i + 1,
                    photo_size_kb: (photos[i].size / 1024).toFixed(0),
                    retry_count: retryCount,
                    job_id: job.id,
                    error: errorMsg
                  }
                });
              } else {
                // Wait progressively longer before retrying (1s, 2s)
                const waitTime = retryCount * 1000;
                console.log(`Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
              }
            }
          }
        }
        setProcessingIndex(-1);
        
        if (directUploadUrls.length === 0) {
          console.error('All direct uploads failed. Errors:', directUploadErrors);
          setErrors(directUploadErrors);
          const totalUploadSize = photos.reduce((sum, p) => sum + (p?.size || 0), 0);
          base44.analytics.track({
            eventName: 'pod_direct_upload_failed',
            properties: { 
              photo_count: photos.length, 
              job_id: job.id,
              total_size_mb: (totalUploadSize / 1024 / 1024).toFixed(2)
            }
          });
          throw new Error(`Unable to upload any photos. Please check your internet connection and try again with fewer or smaller photos. If the issue persists, try taking new photos.`);
        }
        
        // Allow partial success - if at least 50% of photos uploaded, consider it a success
        if (directUploadUrls.length < photos.length * 0.5) {
          console.warn(`Only ${directUploadUrls.length} of ${photos.length} photos uploaded successfully`);
          toast({
            title: "Partial Upload",
            description: `Only ${directUploadUrls.length} of ${photos.length} photos could be uploaded. You may want to retry with fewer or different photos.`,
            variant: "warning",
          });
        }
        
        console.log(`Direct upload succeeded for ${directUploadUrls.length} out of ${photos.length} photos`);
        if (directUploadErrors.length > 0) {
          setErrors(directUploadErrors);
        }
        
        // Skip Phase 2 - we already have the URLs
        const existingPodFiles = job.podFiles || [];
        const allPodFiles = [...existingPodFiles, ...directUploadUrls];

        await base44.entities.Job.update(job.id, {
          ...job,
          podFiles: allPodFiles,
          podNotes: notes || job.podNotes,
          status: 'DELIVERED',
          driverStatus: 'COMPLETED'
        });

        if (notes && notes.trim()) {
          try {
            await sendPODNotesNotification({
              jobId: job.id,
              customerName: job.customerName,
              deliveryLocation: job.deliveryLocation,
              notes: notes.trim(),
              driverName: user?.full_name || 'Driver'
            });
          } catch (emailError) {
            console.error('Failed to send POD notes notification:', emailError);
          }
        }

        toast({
          title: "Delivery Complete!",
          description: `${directUploadUrls.length} photo(s) uploaded successfully!`,
        });

        setPhotos([]);
        setPhotoPreviews([]);
        setNotes('');
        setErrors([]);
        setUploading(false);
        setUploadProgress(0);

        try {
          if (onPODUploaded && typeof onPODUploaded === 'function') {
            onPODUploaded();
          }
        } catch (callbackError) {
          console.error('Error in onPODUploaded callback:', callbackError);
        }

        try {
          if (onOpenChange && typeof onOpenChange === 'function') {
            onOpenChange(false);
          }
        } catch (callbackError) {
          console.error('Error in onOpenChange callback:', callbackError);
        }

        return;
      }
      
      if (currentSubmissionErrors.length > 0) {
        setErrors(currentSubmissionErrors);
        toast({
          title: "Photo Preparation Warnings",
          description: "Some photos encountered issues during preparation. Attempting to proceed with valid ones.",
          variant: "warning",
        });
      }

      // PHASE 2: OFFLINE PATH
      if (!isOnline) {
        await queuePODUpload({
          jobId: job.id,
          photos: compressedPhotosDataURLs,
          notes,
          jobDetails: {
            jobId: job.id,
            customerName: job.customerName,
            deliveryLocation: job.deliveryLocation,
            existingPodFiles: job.podFiles || [],
            driverName: user?.full_name || 'Driver'
          }
        });

        toast({
          title: "Delivery Saved Offline",
          description: `${compressedPhotosDataURLs.length} photo(s) and notes have been saved locally. They will automatically upload when you regain internet connection.`,
          variant: "default",
          duration: 5000,
        });

        onPODUploaded();
        onOpenChange(false);

        setPhotos([]);
        setPhotoPreviews([]);
        setNotes('');
        setErrors([]);
        setUploading(false);
        return;
      }

      // PHASE 2: ONLINE PATH
      const uploadedUrls = [];

      for (let i = 0; i < compressedPhotosDataURLs.length; i++) {
        setProcessingIndex(i);
        try {
          const dataURL = compressedPhotosDataURLs[i];
          
          // More robust blob conversion
          let blob;
          try {
            const response = await fetch(dataURL);
            blob = await response.blob();
          } catch (fetchErr) {
            // Fallback: manually convert data URL to blob
            console.warn('Fetch blob failed, using manual conversion:', fetchErr);
            const arr = dataURL.split(',');
            const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            const bstr = atob(arr[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }
            blob = new Blob([u8arr], { type: mime });
          }
          
          const originalFile = photos[i]; 
          const fileName = originalFile?.name || `pod-${job.id}-${Date.now()}-${i + 1}.jpg`;
          const fileToUpload = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
          
          // Add timeout to prevent hanging uploads
          const uploadPromise = base44.integrations.Core.UploadFile({ file: fileToUpload });
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Upload timeout - server took too long to respond')), 60000)
          );
          
          const result = await Promise.race([uploadPromise, timeoutPromise]);
          
          if (!result || !result.file_url) {
            throw new Error('Upload returned no URL');
          }
          
          uploadedUrls.push(result.file_url);

          const progress = 50 + ((i + 1) / compressedPhotosDataURLs.length) * 50;
          setUploadProgress(Math.round(progress));
        } catch (error) {
          console.error(`Failed to upload photo ${i + 1} (${photos[i]?.name || 'N/A'}):`, error);
          
          // Provide more helpful error messages
          let errorMsg = error.message || 'Upload failed';
          if (errorMsg.includes('timeout')) {
            errorMsg = 'Upload timeout - try using fewer photos or check your connection';
          } else if (errorMsg.includes('Network') || errorMsg.includes('fetch')) {
            errorMsg = 'Network error - check your internet connection';
          }
          
          currentSubmissionErrors.push(`Photo ${i + 1} (${photos[i]?.name || 'N/A'}): ${errorMsg}`);
          base44.analytics.track({
            eventName: 'pod_api_compressed_upload_failed',
            properties: { 
              photo_index: i + 1,
              job_id: job.id,
              error: error.message || 'Upload failed'
            }
          });
        }
      }
      setProcessingIndex(-1);

      if (uploadedUrls.length === 0 && compressedPhotosDataURLs.length > 0) {
        base44.analytics.track({
          eventName: 'pod_upload_complete_failure',
          properties: { 
            photo_count: compressedPhotosDataURLs.length,
            job_id: job.id
          }
        });
        throw new Error('No photos were successfully uploaded. Please try: 1) Using fewer photos, 2) Checking your internet connection, or 3) Taking new photos.');
      }
      
      // Allow partial success - if at least 50% of photos uploaded, proceed
      if (uploadedUrls.length < compressedPhotosDataURLs.length * 0.5 && uploadedUrls.length > 0) {
        console.warn(`Only ${uploadedUrls.length} of ${compressedPhotosDataURLs.length} photos uploaded successfully`);
        toast({
          title: "Partial Upload Warning",
          description: `Only ${uploadedUrls.length} of ${compressedPhotosDataURLs.length} photos uploaded. Proceeding anyway.`,
          variant: "warning",
        });
      }

      const existingPodFiles = job.podFiles || [];
      const allPodFiles = [...existingPodFiles, ...uploadedUrls];

      try {
        await base44.entities.Job.update(job.id, {
          ...job,
          podFiles: allPodFiles,
          podNotes: notes || job.podNotes,
          status: 'DELIVERED',
          driverStatus: 'COMPLETED'
        });
      } catch (updateError) {
        base44.analytics.track({
          eventName: 'pod_api_job_update_failed',
          properties: { 
            job_id: job.id,
            photo_count: allPodFiles.length,
            error: updateError.message || String(updateError)
          }
        });
        throw updateError;
      }

      // Send notification - wrapped in its own try/catch so it doesn't affect main flow
      if (notes && notes.trim()) {
        try {
          await sendPODNotesNotification({
            jobId: job.id,
            customerName: job.customerName,
            deliveryLocation: job.deliveryLocation,
            notes: notes.trim(),
            driverName: user?.full_name || 'Driver'
          });
        } catch (emailError) {
          console.error('Failed to send POD notes notification:', emailError);
        }
      }

      // Show success toast
      let finalToastDescription = `${uploadedUrls.length} photo(s) uploaded successfully!`;
      let finalToastTitle = "Delivery Complete!";
      let finalToastVariant = "default";

      if (currentSubmissionErrors.length > 0) {
        finalToastTitle = "Delivery with Warnings";
        finalToastDescription += ` Some issues were encountered during upload.`;
        finalToastVariant = "warning";
        setErrors(currentSubmissionErrors);
      }

      toast({
        title: finalToastTitle,
        description: finalToastDescription,
        variant: finalToastVariant,
      });

      // Reset state and close dialog - wrap in try/catch to prevent callback errors from showing failure
      setPhotos([]);
      setPhotoPreviews([]);
      setNotes('');
      setErrors([]);
      setUploading(false);
      setUploadProgress(0);
      setProcessingIndex(-1);

      // Call parent callbacks last - these may trigger re-renders or errors we don't control
      try {
        if (onPODUploaded && typeof onPODUploaded === 'function') {
          onPODUploaded();
        }
      } catch (callbackError) {
        console.error('Error in onPODUploaded callback:', callbackError);
      }

      try {
        if (uploadedUrls.length > 0 && onOpenChange && typeof onOpenChange === 'function') {
          onOpenChange(false);
        }
      } catch (callbackError) {
        console.error('Error in onOpenChange callback:', callbackError);
      }

      return; // Exit successfully - don't fall through to catch block

    } catch (error) {
      console.error('POD submission error:', error);
      const errorMessage = error?.message || String(error) || "Failed to submit proof of delivery. Please try again.";
      base44.analytics.track({
        eventName: 'pod_submission_failed',
        properties: { 
          photo_count: photos.length,
          job_id: job.id,
          error: errorMessage,
          is_online: isOnline
        }
      });
      toast({
        title: "Submission Failed",
        description: errorMessage,
        variant: "destructive",
      });
      setProcessingIndex(-1);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleCancel = () => {
    if (uploading) {
      toast({
        title: "Upload in Progress",
        description: "Please wait for the upload/save to complete before canceling.",
        variant: "destructive",
      });
      return;
    }

    onOpenChange(false);
    setPhotos([]);
    setPhotoPreviews([]);
    setNotes('');
    setErrors([]);
    setUploadProgress(0);
  };

  const totalSize = photos.reduce((sum, photo) => sum + photo.size, 0);
  const formattedSize = (totalSize / 1024 / 1024).toFixed(2);

  return (
    <Dialog open={open} onOpenChange={!uploading ? onOpenChange : undefined}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Submit Proof of Delivery
            {!isOnline && (
              <span className="flex items-center gap-1 text-orange-600 text-sm font-normal">
                <WifiOff className="h-4 w-4" />
                Offline Mode
              </span>
            )}
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">
            Upload photos to confirm delivery completion (max {MAX_PHOTOS} photos)
            {!isOnline && " - Photos will be saved and uploaded when you're back online"}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Job Info */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="text-gray-700">
                <span className="font-medium">Customer:</span> {job.customerName}
              </p>
              <p className="text-gray-700">
                <span className="font-medium">Location:</span> {job.deliveryLocation}
              </p>
            </div>

            {/* Offline Warning Banner */}
            {!isOnline && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <WifiOff className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-800">Working Offline</p>
                    <p className="text-xs text-orange-700 mt-1">
                      Your photos and notes will be saved locally and automatically uploaded when you have internet connection.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Photo Upload Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Delivery Photos ({photos.length}/{MAX_PHOTOS})
                </label>
                {totalSize > 0 && (
                  <span className="text-xs text-gray-500">
                    Total: {formattedSize}MB
                  </span>
                )}
              </div>

              {/* Upload Buttons */}
              {photos.length < MAX_PHOTOS && (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {/* Camera Capture Button */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-dashed border-2 border-blue-300 hover:bg-blue-50"
                    disabled={uploading}
                    asChild
                  >
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={uploading}
                      />
                      <Camera className="h-4 w-4 mr-2" />
                      Take Photo
                    </label>
                  </Button>

                  {/* Gallery Selection Button */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-dashed border-2 border-green-300 hover:bg-green-50"
                    disabled={uploading}
                    asChild
                  >
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={uploading}
                      />
                      <ImageIcon className="h-4 w-4 mr-2" />
                      Choose from Gallery
                    </label>
                  </Button>
                </div>
              )}

              {photos.length < MAX_PHOTOS && (
                <p className="text-xs text-gray-500 mb-3">
                  <strong>{MAX_PHOTOS - photos.length} remaining</strong> - You can take photos with your camera or select existing photos from your device
                </p>
              )}

              {/* Photo Preview Grid */}
              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
                  {photoPreviews.map((preview, index) => (
                    <div
                      key={index}
                      className={`relative group aspect-square rounded-lg overflow-hidden border-2 ${
                        processingIndex === index
                          ? 'border-blue-500 ring-2 ring-blue-200'
                          : 'border-gray-200'
                      }`}
                    >
                      <img
                        src={preview.preview}
                        alt={`Preview ${index + 1}`}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Processing Overlay */}
                      {processingIndex === index && (
                        <div className="absolute inset-0 bg-blue-600 bg-opacity-50 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 text-white animate-spin" />
                        </div>
                      )}

                      {/* Delete Button */}
                      {!uploading && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleRemovePhoto(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}

                      {/* Photo number */}
                      <div className="absolute bottom-1 left-1 bg-black bg-opacity-60 text-white text-xs px-2 py-0.5 rounded">
                        {index + 1}
                      </div>

                      {/* File size */}
                      <div className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs px-2 py-0.5 rounded">
                        {(preview.originalSize / 1024).toFixed(0)}KB
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Errors */}
              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-800 mb-1">Some issues occurred:</p>
                      <ul className="text-xs text-red-700 space-y-1">
                        {errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {uploading && (
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {processingIndex >= 0 
                        ? `Processing photo ${processingIndex + 1} of ${photos.length}...`
                        : !isOnline
                        ? 'Saving offline...'
                        : 'Uploading...'}
                    </span>
                    <span className="text-gray-600">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              <p className="text-xs text-gray-500 mt-2">
                <strong>Tip:</strong> Photos will be automatically compressed to ~2MB each for faster upload.
                {!isOnline && ' Photos are saved offline and will sync automatically when connection returns.'}
              </p>
            </div>

            {/* Delivery Notes */}
            <div>
              <label htmlFor="pod-notes" className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Notes (Optional)
              </label>
              <Textarea
                id="pod-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about the delivery (e.g., issues encountered, special instructions followed, etc.)"
                rows={4}
                className="resize-none"
                disabled={uploading}
              />
              <p className="text-xs text-gray-500 mt-1">
                These notes will be visible to dispatchers and will trigger a notification.
              </p>
            </div>
          </div>

          {/* Footer Buttons */}
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={uploading || photos.length === 0}
              className={!isOnline ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {!isOnline ? 'Saving' : 'Uploading'} {uploadProgress}%...
                </>
              ) : (
                <>
                  {!isOnline ? (
                    <>
                      <WifiOff className="h-4 w-4 mr-2" />
                      Save Offline ({photos.length} {photos.length === 1 ? 'photo' : 'photos'})
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Complete Delivery ({photos.length} {photos.length === 1 ? 'photo' : 'photos'})
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}