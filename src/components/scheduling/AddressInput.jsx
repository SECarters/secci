import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { MapPin, Check, Loader2, Search, Building2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AddressInput({ 
  value, 
  onChange, 
  onAddressConfirmed,
  placeholder = "Enter delivery address",
  required = false,
  className,
  customerId = null
}) {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [confirmedAddress, setConfirmedAddress] = useState(null);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Load saved addresses on mount
  useEffect(() => {
    const loadSavedAddresses = async () => {
      try {
        const addresses = await base44.entities.AddressLookup.list('-usageCount', 100);
        setSavedAddresses(addresses);
      } catch (err) {
        console.error('Failed to load saved addresses:', err);
      }
    };
    loadSavedAddresses();
  }, []);

  // Update input when value prop changes
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || '');
    }
  }, [value]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchAddresses = async (query) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    const queryLower = query.toLowerCase();

    // Search own dataset first
    const matchedSaved = savedAddresses.filter(addr => 
      addr.address?.toLowerCase().includes(queryLower) ||
      addr.suburb?.toLowerCase().includes(queryLower) ||
      addr.streetName?.toLowerCase().includes(queryLower) ||
      addr.customerName?.toLowerCase().includes(queryLower)
    ).slice(0, 5);

    // Format saved addresses as suggestions
    const savedSuggestions = matchedSaved.map(addr => ({
      type: 'saved',
      address: addr.address,
      latitude: addr.latitude,
      longitude: addr.longitude,
      streetNumber: addr.streetNumber,
      streetName: addr.streetName,
      streetType: addr.streetType,
      suburb: addr.suburb,
      state: addr.state,
      postcode: addr.postcode,
      customerName: addr.customerName,
      siteNotes: addr.siteNotes,
      id: addr.id,
      usageCount: addr.usageCount
    }));

    // If we have fewer than 5 saved results, search Geoscape Predictive API
    let gnafSuggestions = [];
    if (savedSuggestions.length < 5 && query.length >= 4) {
      try {
        const response = await base44.functions.invoke('geocodeAddress', { query: query, stateFilter: 'QLD' });
        const data = response.data || response;
        
        if (data.success && data.suggestions) {
          gnafSuggestions = data.suggestions
            .filter(s => !savedSuggestions.find(saved => 
              saved.address?.toLowerCase() === s.address?.toLowerCase()
            ))
            .slice(0, 5 - savedSuggestions.length)
            .map(s => ({
              type: 'gnaf',
              address: s.address,
              addressId: s.addressId,
              // Coordinates come later when user selects (2-step flow)
              latitude: s.latitude,
              longitude: s.longitude,
              suburb: s.suburb,
              state: s.state,
              postcode: s.postcode,
              matchType: s.matchType,
              matchQuality: s.matchQuality
            }));
        }
      } catch (err) {
        console.error('Geoscape search failed:', err);
      }
    }

    setSuggestions([...savedSuggestions, ...gnafSuggestions]);
    setShowSuggestions(true);
    setLoading(false);
  };

  const geocodeAddressFunc = async (address) => {
    setGeocoding(true);
    try {
      const response = await base44.functions.invoke('geocodeAddress', { query: address });
      const data = response.data || response;
      
      if (data.success && data.result) {
        return {
          formattedAddress: data.result.formattedAddress || address,
          latitude: data.result.latitude,
          longitude: data.result.longitude,
          suburb: data.result.suburb,
          state: data.result.state,
          postcode: data.result.postcode
        };
      }
      return null;
    } catch (err) {
      console.error('Geocoding failed:', err);
      return null;
    } finally {
      setGeocoding(false);
    }
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setConfirmedAddress(null);
    onChange?.(newValue);
    searchAddresses(newValue);
  };

  const handleSelectSuggestion = async (suggestion) => {
    setInputValue(suggestion.address);
    onChange?.(suggestion.address);
    setShowSuggestions(false);

    // For saved addresses with coordinates - use directly
    if (suggestion.type === 'saved' && suggestion.latitude && suggestion.longitude) {
      setConfirmedAddress({
        address: suggestion.address,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude
      });
      onAddressConfirmed?.({
        address: suggestion.address,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        streetNumber: suggestion.streetNumber,
        streetName: suggestion.streetName,
        streetType: suggestion.streetType,
        suburb: suggestion.suburb,
        state: suggestion.state,
        postcode: suggestion.postcode,
        siteNotes: suggestion.siteNotes
      });
      
      // Update usage count
      try {
        await base44.entities.AddressLookup.update(suggestion.id, {
          usageCount: (suggestion.usageCount || 0) + 1
        });
      } catch (err) {
        console.error('Failed to update usage count:', err);
      }
      return;
    }

    // For GNAF suggestions - fetch full details with coordinates using addressId
    if (suggestion.type === 'gnaf' && suggestion.addressId) {
      setGeocoding(true);
      try {
        const response = await base44.functions.invoke('geocodeAddress', { 
          addressId: suggestion.addressId 
        });
        const data = response.data || response;
        
        if (data.success && data.result) {
          const result = data.result;
          setConfirmedAddress({
            address: result.address,
            latitude: result.latitude,
            longitude: result.longitude
          });
          onAddressConfirmed?.({
            address: result.address,
            latitude: result.latitude,
            longitude: result.longitude,
            streetNumber: result.streetNumber,
            streetName: result.streetName,
            streetType: result.streetType,
            suburb: result.suburb,
            state: result.state,
            postcode: result.postcode
          });

          // Save to local database for future use — deduplicate first
          try {
            const existing = savedAddresses.find(a =>
              a.address?.toLowerCase() === result.address?.toLowerCase()
            );
            if (existing) {
              await base44.entities.AddressLookup.update(existing.id, { usageCount: (existing.usageCount || 0) + 1 });
            } else {
              await base44.entities.AddressLookup.create({
                address: result.address,
                streetNumber: result.streetNumber,
                streetName: result.streetName,
                streetType: result.streetType,
                suburb: result.suburb,
                state: result.state,
                postcode: result.postcode,
                latitude: result.latitude,
                longitude: result.longitude,
                usageCount: 1,
                ...(customerId ? { customerId } : {})
              });
            }
            const addresses = await base44.entities.AddressLookup.list('-usageCount', 100);
            setSavedAddresses(addresses);
          } catch (err) {
            console.error('Failed to save address:', err);
          }
        }
      } catch (err) {
        console.error('Failed to fetch address details:', err);
      } finally {
        setGeocoding(false);
      }
      return;
    }

    // Fallback - geocode the address text
    const geocoded = await geocodeAddressFunc(suggestion.address);
    if (geocoded) {
      setConfirmedAddress(geocoded);
      onAddressConfirmed?.({
        address: geocoded.formattedAddress || suggestion.address,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        streetNumber: geocoded.streetNumber,
        streetName: geocoded.streetName,
        streetType: geocoded.streetType,
        suburb: geocoded.suburb,
        state: geocoded.state,
        postcode: geocoded.postcode
      });
    }
  };

  const handleConfirmAddress = async () => {
    if (!inputValue.trim()) return;
    
    const geocoded = await geocodeAddressFunc(inputValue);
    if (geocoded) {
      setInputValue(geocoded.formattedAddress);
      onChange?.(geocoded.formattedAddress);
      setConfirmedAddress(geocoded);
      onAddressConfirmed?.({
        address: geocoded.formattedAddress,
        latitude: geocoded.latitude,
        longitude: geocoded.longitude,
        streetNumber: geocoded.streetNumber,
        streetName: geocoded.streetName,
        streetType: geocoded.streetType,
        suburb: geocoded.suburb,
        state: geocoded.state,
        postcode: geocoded.postcode
      });

      // Save to own dataset for future use
      try {
        const existing = savedAddresses.find(a => 
          a.address?.toLowerCase() === geocoded.formattedAddress.toLowerCase()
        );
        if (!existing) {
          await base44.entities.AddressLookup.create({
            address: geocoded.formattedAddress,
            streetNumber: geocoded.streetNumber,
            streetName: geocoded.streetName,
            streetType: geocoded.streetType,
            suburb: geocoded.suburb,
            state: geocoded.state,
            postcode: geocoded.postcode,
            latitude: geocoded.latitude,
            longitude: geocoded.longitude,
            usageCount: 1
          });
        }
      } catch (err) {
        console.error('Failed to save address:', err);
      }
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => inputValue.length >= 3 && searchAddresses(inputValue)}
            placeholder={placeholder}
            required={required}
            className={cn(
              className,
              confirmedAddress && "border-green-500 pr-8"
            )}
          />
          {confirmedAddress && (
            <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleConfirmAddress}
          disabled={!inputValue.trim() || geocoding}
          className="shrink-0"
        >
          {geocoding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <MapPin className="h-4 w-4 mr-1" />
              Verify
            </>
          )}
        </Button>
      </div>

      {/* Confirmation status */}
      {confirmedAddress && (
        <div className="mt-1 flex items-center gap-1 text-xs text-green-600">
          <Check className="h-3 w-3" />
          Address verified
          {confirmedAddress.latitude && (
            <span className="text-gray-400 ml-1">
              ({confirmedAddress.latitude.toFixed(4)}, {confirmedAddress.longitude.toFixed(4)})
            </span>
          )}
        </div>
      )}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div 
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSelectSuggestion(suggestion)}
              className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-start gap-2 border-b last:border-b-0"
            >
              {suggestion.type === 'saved' ? (
                <Building2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              ) : suggestion.type === 'gnaf' ? (
                <MapPin className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              ) : (
                <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {suggestion.address}
                </div>
                {suggestion.customerName && (
                  <div className="text-xs text-blue-600">
                    {suggestion.customerName}
                  </div>
                )}
                {suggestion.type === 'saved' && (
                  <div className="text-xs text-gray-400">From your saved addresses</div>
                )}
                {suggestion.type === 'gnaf' && (
                  <div className="text-xs text-green-600">GNAF verified address</div>
                )}
              </div>
              {suggestion.type === 'saved' && suggestion.latitude && (
                <Check className="h-4 w-4 text-green-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching addresses...
        </div>
      )}
    </div>
  );
}