'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, Camera, X, Image } from 'lucide-react';
import { photoApi } from '@/lib/api';
import { TYPES_PHOTO } from '@/lib/constants';

export default function PhotoUploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultCanardId = searchParams.get('canard_id') || '';

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [canardId, setCanardId] = useState<string>(defaultCanardId);
  const [type, setType] = useState<string>('canard');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    // Vérifier la taille des fichiers (max 10MB)
    const validFiles = selectedFiles.filter((file) => file.size <= 10 * 1024 * 1024);

    if (validFiles.length !== selectedFiles.length) {
      alert('Certains fichiers dépassent la limite de 10MB');
    }

    setFiles((prev) => [...prev, ...validFiles]);

    // Créer les previews
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      alert('Veuillez sélectionner au moins une photo');
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);
        if (canardId) formData.append('canard_id', canardId);
        formData.append('type', type);
        formData.append('description', description);

        await photoApi.upload(formData);
        setProgress(((i + 1) / files.length) * 100);
      }

      alert(`${files.length} photo(s) uploadée(s) avec succès !`);

      if (canardId) {
        router.push(`/canards/${canardId}`);
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Erreur upload:', error);
      alert('Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });

      // Créer un élément video temporaire
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      // Créer un canvas pour capturer l'image
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);

      // Convertir en blob
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
          setFiles((prev) => [...prev, file]);
          setPreviews((prev) => [...prev, canvas.toDataURL('image/jpeg')]);
        }
      }, 'image/jpeg', 0.9);

      // Arrêter le stream
      stream.getTracks().forEach((track) => track.stop());
    } catch (error) {
      console.error('Erreur caméra:', error);
      alert('Impossible d\'accéder à la caméra');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-gray-800">Upload Photos</h1>

        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Canard ID */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ID Canard (optionnel)
            </label>
            <input
              type="number"
              value={canardId}
              onChange={(e) => setCanardId(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Laisser vide pour une photo générale"
            />
          </div>

          {/* Type de photo */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de photo
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {TYPES_PHOTO.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (optionnelle)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Ajouter une description..."
            />
          </div>

          {/* Zone d'upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photos
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="mx-auto text-gray-400 mb-4" size={48} />
                <p className="text-gray-600 mb-2">Cliquez pour sélectionner des photos</p>
                <p className="text-sm text-gray-500">ou glissez-déposez vos fichiers ici</p>
                <p className="text-xs text-gray-400 mt-2">Max 10MB par fichier</p>
              </label>
            </div>

            {/* Bouton caméra */}
            <button
              onClick={handleCameraCapture}
              className="mt-4 w-full p-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 flex items-center justify-center gap-2"
            >
              <Camera size={20} />
              Prendre une photo avec la caméra
            </button>
          </div>

          {/* Previews */}
          {previews.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Image size={20} />
                Aperçu ({previews.length} photo{previews.length > 1 ? 's' : ''})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {previews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Barre de progression */}
          {uploading && (
            <div className="mb-6">
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Upload en cours...</span>
                <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleUpload}
              disabled={uploading || files.length === 0}
              className="flex-1 bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
            >
              <Upload size={20} />
              {uploading ? 'Upload...' : `Uploader ${files.length} photo(s)`}
            </button>
            <button
              onClick={() => router.back()}
              className="px-6 bg-gray-300 text-gray-700 p-3 rounded-lg font-bold hover:bg-gray-400"
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
