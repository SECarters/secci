import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Save, Star, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function SavedFilters({ currentFilters, onApplyFilter }) {
  const [savedFilters, setSavedFilters] = useState([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
        loadSavedFilters(currentUser);
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    };
    init();
  }, []);

  const loadSavedFilters = (currentUser) => {
    const saved = localStorage.getItem(`savedFilters_${currentUser.id}`);
    if (saved) {
      try {
        setSavedFilters(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to parse saved filters:', error);
      }
    }
  };

  const handleSaveFilter = () => {
    if (!filterName.trim()) {
      toast.error('Please enter a filter name');
      return;
    }

    const newFilter = {
      id: Date.now().toString(),
      name: filterName,
      filters: currentFilters,
      createdAt: new Date().toISOString()
    };

    const updated = [...savedFilters, newFilter];
    setSavedFilters(updated);
    localStorage.setItem(`savedFilters_${user.id}`, JSON.stringify(updated));
    
    setShowSaveDialog(false);
    setFilterName('');
    toast.success('Filter saved successfully');
  };

  const handleDeleteFilter = (filterId) => {
    const updated = savedFilters.filter(f => f.id !== filterId);
    setSavedFilters(updated);
    localStorage.setItem(`savedFilters_${user.id}`, JSON.stringify(updated));
    toast.success('Filter deleted');
  };

  if (!user) return null;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {savedFilters.map((filter) => (
          <Badge
            key={filter.id}
            variant="outline"
            className="cursor-pointer hover:bg-blue-50 px-3 py-1 gap-2"
          >
            <span onClick={() => onApplyFilter(filter.filters)}>
              <Star className="h-3 w-3 fill-blue-500 text-blue-500" />
            </span>
            <span onClick={() => onApplyFilter(filter.filters)}>
              {filter.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFilter(filter.id);
              }}
              className="hover:text-red-600"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSaveDialog(true)}
          className="gap-2"
        >
          <Save className="h-4 w-4" />
          Save Current Filter
        </Button>
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Filter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="filterName">Filter Name</Label>
              <Input
                id="filterName"
                placeholder="e.g. My Urgent Jobs"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleSaveFilter();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFilter}>
              Save Filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}