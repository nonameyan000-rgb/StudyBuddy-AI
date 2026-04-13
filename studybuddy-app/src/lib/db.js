import { supabase } from "./supabaseClient";

/**
 * Helper: always get a fresh, verified user ID directly from Supabase Auth.
 * This guarantees the token is valid and user_id matches auth.uid() for RLS.
 */
async function getCurrentUserId() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Not authenticated. Please log in again.");
  }
  return user.id;
}

/**
 * Fetch all documents belonging to the current user.
 */
export async function fetchUserDocuments() {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch documents: ${error.message}`);
  return data ?? [];
}

/**
 * Fetch the deck and all flashcards for a given document_id.
 */
export async function fetchCardsForDocument(documentId) {
  // Find the deck for this document
  const { data: deck, error: deckError } = await supabase
    .from('decks')
    .select('*')
    .eq('document_id', documentId)
    .single();

  if (deckError) {
    // No deck yet (cards not generated) — return empty
    if (deckError.code === 'PGRST116') return [];
    throw new Error(`Failed to fetch deck: ${deckError.message}`);
  }

  // Fetch the flashcards for that deck
  const { data: cards, error: cardsError } = await supabase
    .from('flashcards')
    .select('*')
    .eq('deck_id', deck.id)
    .order('created_at', { ascending: true });

  if (cardsError) throw new Error(`Failed to fetch flashcards: ${cardsError.message}`);
  return cards ?? [];
}


/**
 * Uploads a file to Supabase Storage and persists metadata to the documents table.
 * Returns the DB record plus the public URL for immediate preview.
 */
export async function uploadDocument(userIdFromContext, file) {
  const userId = await getCurrentUserId();

  // 1. Upload raw file to the 'documents' bucket
  const storagePath = `${userId}/${Date.now()}_${file.name}`;

  const { data: storageData, error: storageError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (storageError) {
    console.error('❌ Storage Upload Error:', storageError);
    throw new Error(`Storage upload failed: ${storageError.message}`);
  }


  // 2. Get the public URL
  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(storageData.path);

  const publicUrl = urlData?.publicUrl ?? null;

  // 3. Save the document record with BOTH file_url and storage_path
  const { data, error } = await supabase
    .from('documents')
    .insert([
      {
        user_id: userId,
        filename: file.name,
        file_size_bytes: file.size,
        parsing_status: 'completed',
        file_url: publicUrl,
        storage_path: storageData.path,  // Save path so we can always re-derive URL
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('❌ Supabase Document Insert Error:', error);
    throw new Error(`Document insert failed: ${error.message}`);
  }

  return { ...data, rawFile: file };
}

/**
 * Download a document fully as a Blob from Supabase Storage.
 * This bypasses CORS issues by letting the browser use a local Object URL.
 */
export async function downloadDocumentBlob(storagePath) {
  if (!storagePath) return null;

  const { data, error } = await supabase.storage
    .from('documents')
    .download(storagePath);

  if (error) {
    console.error('❌ Failed to download blob:', error);
    return null;
  }
  
  return data;
}

/**
 * Determine if a document is an image based on its filename extension.
 * More reliable than checking the storage URL (which may have timestamps/tokens).
 */
export function isImageFilename(filename) {
  return /\.(jpe?g|jpg|png|webp|gif)$/i.test(filename ?? '');
}




/**
 * Creates a Deck and bulk-inserts all AI-generated Flashcards.
 */
export async function saveGeneratedDeckAndCards(userIdFromContext, documentId, title, generatedCards) {
  const userId = await getCurrentUserId();

  // 1. Create the Deck
  const { data: deck, error: deckError } = await supabase
    .from('decks')
    .insert([
      {
        user_id: userId,
        document_id: documentId,
        title: title || "AI Generated Study Deck",
        summary: "Created via StudyBuddy AI Engine."
      }
    ])
    .select()
    .single();

  if (deckError) {
    console.error("❌ Deck Creation Error:", deckError);
    throw new Error(`Deck insert failed: ${deckError.message}`);
  }

  // 2. Bulk-insert Flashcards
  const insertPayload = generatedCards.map((card) => ({
    user_id: userId,
    deck_id: deck.id,
    front: card.front,
    back: card.back
  }));

  const { data: flashcards, error: flashcardsError } = await supabase
    .from('flashcards')
    .insert(insertPayload)
    .select();

  if (flashcardsError) {
    console.error("❌ Flashcards Insert Error:", flashcardsError);
    throw new Error(`Flashcards insert failed: ${flashcardsError.message}`);
  }

  return { deck, cards: flashcards };
}

/**
 * Deletes a document fully (Storage + Database)
 */
export async function deleteDocument(doc) {
  if (!doc) return;
  
  // 1. Storage First
  if (doc.storage_path) {
    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([doc.storage_path]);
      
    if (storageError) {
      console.error('❌ Failed to delete from storage:', storageError);
      throw new Error(`Storage deletion failed: ${storageError.message}`);
    }
  }

  // 2. Database Second
  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', doc.id);

  if (dbError) {
    console.error('❌ Failed to delete from database:', dbError);
    throw new Error(`Database record deletion failed: ${dbError.message}`);
  }
}

/**
 * Renames a document in the database
 */
export async function renameDocument(documentId, newFilename) {
  const { error } = await supabase
    .from('documents')
    .update({ filename: newFilename })
    .eq('id', documentId);

  if (error) throw new Error(`Rename failed: ${error.message}`);
}
