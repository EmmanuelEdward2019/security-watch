import { create } from 'zustand';
import type { Property, PropertyDocument, PropertyRequest } from '@/types';
import { supabase, STORAGE_BUCKETS } from '@/lib/supabase';

interface PropertyState {
  properties: Property[];
  currentProperty: Property | null;
  documents: PropertyDocument[];
  requests: PropertyRequest[];
  isLoading: boolean;
  error: string | null;
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
  submitForReview: (id: string) => Promise<{ error: string | null }>;
  deleteProperty: (id: string) => Promise<{ error: string | null }>;
  fetchDocuments: (propertyId: string) => Promise<void>;
  addDocument: (doc: Partial<PropertyDocument>) => Promise<{ error: string | null }>;
  deleteDocument: (doc: PropertyDocument) => Promise<{ error: string | null }>;
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
  error: null,
  filters: {},

  fetchProperties: async (ownerId) => {
    set({ isLoading: true, error: null });
    let query = supabase
      .from('properties')
      .select('*, owner:profiles!owner_id(user_id, full_name, avatar_url, phone, email)')
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
    if (error) {
      set({ error: error.message, isLoading: false });
      return;
    }
    set({ properties: (data ?? []) as Property[], isLoading: false });
  },

  fetchProperty: async (id) => {
    set({ error: null });
    const { data, error } = await supabase
      .from('properties')
      .select('*, owner:profiles!owner_id(user_id, full_name, avatar_url, phone, email)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      set({ error: error.message });
      return;
    }
    set({ currentProperty: (data as Property) ?? null });
  },

  createProperty: async (property) => {
    // `status` is forced to 'unverified' on insert by a trigger — the verified
    // badge is granted by an admin, never claimed by the owner.
    const { data, error } = await supabase
      .from('properties')
      .insert({
        owner_id: property.owner_id,
        title: property.title,
        description: property.description,
        property_type: property.property_type,
        price: property.price,
        currency: property.currency ?? 'NGN',
        location: property.location,
        address: property.address,
        bedrooms: property.bedrooms ?? null,
        bathrooms: property.bathrooms ?? null,
        area_sqm: property.area_sqm ?? null,
        listing_type: property.listing_type,
        images: property.images ?? [],
        features: property.features ?? [],
      })
      .select('id')
      .single();

    if (error) return { id: null, error: error.message };
    return { id: data.id, error: null };
  },

  updateProperty: async (id, updates) => {
    // An owner may not set `status`. The one legal self-service transition is
    // submitting an unverified listing for review, which submitForReview() does.
    const { status: _ignoredStatus, owner_id: _ignoredOwner, ...safe } = updates;
    const { error } = await supabase.from('properties').update(safe).eq('id', id);

    if (error) return { error: error.message };
    return { error: null };
  },

  /** Moves an owner's listing into the admin verification queue. */
  submitForReview: async (id) => {
    const { error } = await supabase
      .from('properties')
      .update({ status: 'pending' })
      .eq('id', id);

    if (error) return { error: error.message };
    await get().fetchProperty(id);
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

    if (error) {
      set({ error: error.message });
      return;
    }
    set({ documents: (data ?? []) as PropertyDocument[] });
  },

  addDocument: async (doc) => {
    const { error } = await supabase.from('property_documents').insert(doc);
    if (error) return { error: error.message };
    return { error: null };
  },

  /**
   * Removes a document and its stored file.
   *
   * The row goes first, deliberately. An orphaned object is a storage cost; a
   * row pointing at a file that no longer exists is a broken document in the
   * owner's list and in an administrator's verification queue.
   */
  deleteDocument: async (doc) => {
    const { error } = await supabase.from('property_documents').delete().eq('id', doc.id);
    if (error) return { error: error.message };

    // Best effort — the row is gone either way.
    await supabase.storage.from(STORAGE_BUCKETS.PROPERTY_DOCUMENTS).remove([doc.file_url]);

    set((state) => ({ documents: state.documents.filter((d) => d.id !== doc.id) }));
    return { error: null };
  },

  fetchRequests: async (userId, asOwner = false) => {
    set({ error: null });

    // `property:properties.owner_id` was not a valid PostgREST filter, so the
    // landlord view silently returned nothing. Filtering an embedded resource
    // needs the relation name and an inner join.
    let query = supabase
      .from('property_requests')
      .select(
        asOwner
          ? '*, requester:profiles!requester_id(user_id, full_name, email, phone, avatar_url), properties!inner(*)'
          : '*, requester:profiles!requester_id(user_id, full_name, email, phone, avatar_url), properties(*)'
      )
      .order('created_at', { ascending: false });

    if (asOwner) {
      query = query.eq('properties.owner_id', userId);
    } else {
      query = query.eq('requester_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      set({ error: error.message });
      return;
    }

    const requests = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      property: row.properties ?? row.property,
    })) as PropertyRequest[];

    set({ requests });
  },

  createRequest: async (request) => {
    const { error } = await supabase.from('property_requests').insert({
      property_id: request.property_id,
      requester_id: request.requester_id,
      message: request.message,
    });
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
