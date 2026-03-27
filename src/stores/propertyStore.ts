import { create } from 'zustand';
import type { Property, PropertyDocument, PropertyRequest } from '@/types';
import { supabase } from '@/lib/supabase';

interface PropertyState {
  properties: Property[];
  currentProperty: Property | null;
  documents: PropertyDocument[];
  requests: PropertyRequest[];
  isLoading: boolean;
  filters: {
    location?: string;
    minPrice?: number;
    maxPrice?: number;
    propertyType?: string;
    listingType?: string;
    status?: string;
    search?: string;
  };

  fetchProperties: (ownerId?: string) => Promise<void>;
  fetchProperty: (id: string) => Promise<void>;
  createProperty: (property: Partial<Property>) => Promise<{ id: string | null; error: string | null }>;
  updateProperty: (id: string, updates: Partial<Property>) => Promise<{ error: string | null }>;
  deleteProperty: (id: string) => Promise<{ error: string | null }>;
  fetchDocuments: (propertyId: string) => Promise<void>;
  addDocument: (doc: Partial<PropertyDocument>) => Promise<{ error: string | null }>;
  fetchRequests: (userId: string, asOwner?: boolean) => Promise<void>;
  createRequest: (request: Partial<PropertyRequest>) => Promise<{ error: string | null }>;
  updateRequest: (id: string, status: 'accepted' | 'rejected') => Promise<{ error: string | null }>;
  setFilters: (filters: PropertyState['filters']) => void;
}

export const usePropertyStore = create<PropertyState>((set, get) => ({
  properties: [],
  currentProperty: null,
  documents: [],
  requests: [],
  isLoading: false,
  filters: {},

  fetchProperties: async (ownerId) => {
    set({ isLoading: true });
    let query = supabase
      .from('properties')
      .select('*, owner:profiles!owner_id(*)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (ownerId) query = query.eq('owner_id', ownerId);

    const { location, minPrice, maxPrice, propertyType, listingType, search } = get().filters;
    if (location) query = query.ilike('location', `%${location}%`);
    if (minPrice) query = query.gte('price', minPrice);
    if (maxPrice) query = query.lte('price', maxPrice);
    if (propertyType) query = query.eq('property_type', propertyType);
    if (listingType) query = query.eq('listing_type', listingType);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error } = await query;
    if (!error && data) set({ properties: data as Property[] });
    set({ isLoading: false });
  },

  fetchProperty: async (id) => {
    const { data, error } = await supabase
      .from('properties')
      .select('*, owner:profiles!owner_id(*)')
      .eq('id', id)
      .single();

    if (!error && data) set({ currentProperty: data as Property });
  },

  createProperty: async (property) => {
    const { data, error } = await supabase
      .from('properties')
      .insert(property)
      .select()
      .single();

    if (error) return { id: null, error: error.message };
    return { id: data.id, error: null };
  },

  updateProperty: async (id, updates) => {
    const { error } = await supabase
      .from('properties')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return { error: error.message };
    return { error: null };
  },

  deleteProperty: async (id) => {
    const { error } = await supabase
      .from('properties')
      .update({ is_active: false })
      .eq('id', id);

    if (error) return { error: error.message };
    return { error: null };
  },

  fetchDocuments: async (propertyId) => {
    const { data, error } = await supabase
      .from('property_documents')
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (!error && data) set({ documents: data as PropertyDocument[] });
  },

  addDocument: async (doc) => {
    const { error } = await supabase.from('property_documents').insert(doc);
    if (error) return { error: error.message };
    return { error: null };
  },

  fetchRequests: async (userId, asOwner = false) => {
    let query = supabase
      .from('property_requests')
      .select('*, requester:profiles!requester_id(*), property:properties!property_id(*)')
      .order('created_at', { ascending: false });

    if (asOwner) {
      query = query.eq('property:properties.owner_id', userId);
    } else {
      query = query.eq('requester_id', userId);
    }

    const { data, error } = await query;
    if (!error && data) set({ requests: data as PropertyRequest[] });
  },

  createRequest: async (request) => {
    const { error } = await supabase.from('property_requests').insert(request);
    if (error) return { error: error.message };
    return { error: null };
  },

  updateRequest: async (id, status) => {
    const { error } = await supabase
      .from('property_requests')
      .update({ status })
      .eq('id', id);

    if (error) return { error: error.message };
    return { error: null };
  },

  setFilters: (filters) => set({ filters }),
}));
