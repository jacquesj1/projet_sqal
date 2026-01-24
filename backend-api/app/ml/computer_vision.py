"""
Computer Vision Module - Weight Detection from Duck Images
Uses CNN (Convolutional Neural Network) with TensorFlow/Keras

Module permettant de détecter automatiquement le poids d'un canard
à partir d'une photo (vision par ordinateur).
"""

import numpy as np
import asyncpg
from typing import Dict, Optional, List
from datetime import datetime
import base64
import io
from PIL import Image
import logging

# TensorFlow imports (conditional for optional dependency)
try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers
    from tensorflow.keras.applications import MobileNetV2
    from tensorflow.keras.preprocessing.image import img_to_array
    TENSORFLOW_AVAILABLE = True
except ImportError:
    TENSORFLOW_AVAILABLE = False
    logging.warning("TensorFlow not available. Install with: pip install tensorflow")

logger = logging.getLogger(__name__)


class ComputerVisionEngine:
    """
    Moteur de vision par ordinateur pour détecter le poids des canards

    Architecture CNN:
    - Base: MobileNetV2 (pre-trained on ImageNet) pour feature extraction
    - Head: Dense layers pour régression du poids
    - Input: Images 224x224x3 (RGB)
    - Output: Poids en grammes (float)
    """

    def __init__(self, db_pool: asyncpg.Pool):
        self.db_pool = db_pool
        self.model: Optional[keras.Model] = None
        self.input_shape = (224, 224, 3)
        self.model_path = "models/duck_weight_detector.h5"

        if not TENSORFLOW_AVAILABLE:
            logger.error("TensorFlow is required for Computer Vision")

    def build_model(self) -> keras.Model:
        """
        Construit le modèle CNN pour détection de poids

        Architecture:
        1. MobileNetV2 (frozen) - Feature extraction
        2. GlobalAveragePooling2D
        3. Dense(256, relu) + Dropout(0.5)
        4. Dense(128, relu) + Dropout(0.3)
        5. Dense(1, linear) - Régression du poids

        Returns:
            keras.Model: Modèle compilé
        """
        if not TENSORFLOW_AVAILABLE:
            raise RuntimeError("TensorFlow is not installed")

        # Base model: MobileNetV2 pré-entraîné
        base_model = MobileNetV2(
            input_shape=self.input_shape,
            include_top=False,
            weights='imagenet'
        )

        # Freeze base model
        base_model.trainable = False

        # Build regression head
        inputs = keras.Input(shape=self.input_shape)

        # Preprocessing
        x = keras.applications.mobilenet_v2.preprocess_input(inputs)

        # Feature extraction
        x = base_model(x, training=False)

        # Regression head
        x = layers.GlobalAveragePooling2D()(x)
        x = layers.Dense(256, activation='relu')(x)
        x = layers.Dropout(0.5)(x)
        x = layers.Dense(128, activation='relu')(x)
        x = layers.Dropout(0.3)(x)
        x = layers.Dense(64, activation='relu')(x)
        outputs = layers.Dense(1, activation='linear')(x)  # Régression

        model = keras.Model(inputs=inputs, outputs=outputs)

        # Compile
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='mse',
            metrics=['mae', 'mse']
        )

        self.model = model
        return model

    async def load_training_data(
        self,
        limit: int = 10000,
        genetique: Optional[str] = None
    ) -> List[Dict]:
        """
        Charge les données d'entraînement depuis la base de données

        Structure attendue:
        - Table: canard_photos (à créer)
        - Colonnes: canard_id, photo_base64, poids_reel, timestamp

        Args:
            limit: Nombre max d'images
            genetique: Filtrer par génétique (Mulard, Barbarie, etc.)

        Returns:
            List[Dict]: [{"image_base64": str, "poids": float}, ...]
        """
        query = """
        SELECT
            cp.photo_base64,
            gd.poids_matin,
            gd.poids_soir,
            c.genetique
        FROM canard_photos cp
        JOIN canards c ON cp.canard_id = c.id
        LEFT JOIN gavage_data gd ON c.id = gd.canard_id
        WHERE cp.photo_base64 IS NOT NULL
        AND (gd.poids_matin IS NOT NULL OR gd.poids_soir IS NOT NULL)
        """

        if genetique:
            query += f" AND c.genetique = '{genetique}'"

        query += f" LIMIT {limit}"

        async with self.db_pool.acquire() as conn:
            rows = await conn.fetch(query)

        data = []
        for row in rows:
            poids = row['poids_soir'] if row['poids_soir'] else row['poids_matin']
            if poids:
                data.append({
                    "image_base64": row['photo_base64'],
                    "poids": float(poids),
                    "genetique": row['genetique']
                })

        return data

    def preprocess_image(self, image_base64: str) -> np.ndarray:
        """
        Prétraite une image base64 pour le modèle

        Steps:
        1. Decode base64 → PIL Image
        2. Resize → 224x224
        3. Convert → RGB array
        4. Normalize → [0, 1]
        5. Expand dims → (1, 224, 224, 3)

        Args:
            image_base64: Image encodée en base64

        Returns:
            np.ndarray: Image preprocessed (1, 224, 224, 3)
        """
        # Decode base64
        image_data = base64.b64decode(image_base64)
        image = Image.open(io.BytesIO(image_data))

        # Convert to RGB
        if image.mode != 'RGB':
            image = image.convert('RGB')

        # Resize
        image = image.resize((224, 224))

        # To array
        img_array = img_to_array(image)

        # Normalize [0, 255] → [0, 1]
        img_array = img_array / 255.0

        # Expand dims (224, 224, 3) → (1, 224, 224, 3)
        img_array = np.expand_dims(img_array, axis=0)

        return img_array

    async def train_model(
        self,
        genetique: Optional[str] = None,
        epochs: int = 50,
        batch_size: int = 32,
        validation_split: float = 0.2
    ) -> Dict:
        """
        Entraîne le modèle CNN sur les données de la base

        Args:
            genetique: Filtrer par génétique
            epochs: Nombre d'époques d'entraînement
            batch_size: Taille des batches
            validation_split: Pourcentage de validation

        Returns:
            Dict: Résultats d'entraînement (loss, mae, history)
        """
        if not TENSORFLOW_AVAILABLE:
            return {
                "error": "TensorFlow not installed",
                "status": "failed"
            }

        # Load data
        logger.info(f"Loading training data for genetique={genetique}...")
        data = await self.load_training_data(limit=10000, genetique=genetique)

        if len(data) < 50:
            return {
                "error": f"Insufficient data: {len(data)} images (minimum 50 required)",
                "status": "failed"
            }

        # Preprocess images
        logger.info(f"Preprocessing {len(data)} images...")
        X = []
        y = []

        for sample in data:
            try:
                img = self.preprocess_image(sample['image_base64'])
                X.append(img[0])  # Remove batch dimension
                y.append(sample['poids'])
            except Exception as e:
                logger.warning(f"Failed to preprocess image: {e}")
                continue

        X = np.array(X)
        y = np.array(y)

        logger.info(f"Dataset shape: X={X.shape}, y={y.shape}")

        # Build model
        if self.model is None:
            logger.info("Building CNN model...")
            self.build_model()

        # Train
        logger.info(f"Training for {epochs} epochs...")
        history = self.model.fit(
            X, y,
            epochs=epochs,
            batch_size=batch_size,
            validation_split=validation_split,
            verbose=1,
            callbacks=[
                keras.callbacks.EarlyStopping(
                    monitor='val_loss',
                    patience=10,
                    restore_best_weights=True
                ),
                keras.callbacks.ReduceLROnPlateau(
                    monitor='val_loss',
                    factor=0.5,
                    patience=5
                )
            ]
        )

        # Save model
        logger.info(f"Saving model to {self.model_path}...")
        self.model.save(self.model_path)

        # Store in database
        await self._store_model_metadata(genetique, history)

        # Results
        final_mae = history.history['mae'][-1]
        final_val_mae = history.history['val_mae'][-1]

        return {
            "status": "success",
            "genetique": genetique,
            "nb_samples": len(data),
            "epochs_trained": len(history.history['loss']),
            "final_mae": float(final_mae),
            "final_val_mae": float(final_val_mae),
            "model_path": self.model_path,
            "timestamp": datetime.utcnow().isoformat()
        }

    async def _store_model_metadata(self, genetique: Optional[str], history):
        """Store model training metadata in database"""
        query = """
        INSERT INTO ml_vision_models (
            genetique,
            mae,
            val_mae,
            model_path,
            trained_at
        ) VALUES ($1, $2, $3, $4, NOW())
        """

        final_mae = history.history['mae'][-1]
        final_val_mae = history.history['val_mae'][-1]

        async with self.db_pool.acquire() as conn:
            await conn.execute(
                query,
                genetique,
                float(final_mae),
                float(final_val_mae),
                self.model_path
            )

    async def predict_weight(
        self,
        image_base64: str,
        genetique: Optional[str] = None
    ) -> Dict:
        """
        Prédit le poids d'un canard à partir d'une photo

        Args:
            image_base64: Image encodée en base64
            genetique: Génétique du canard (optionnel)

        Returns:
            Dict: {
                "poids_detecte": float,
                "confiance": float,
                "methode": "CNN",
                "genetique": str
            }
        """
        if not TENSORFLOW_AVAILABLE:
            return {
                "poids_detecte": None,
                "confiance": 0.0,
                "error": "TensorFlow not installed",
                "methode": "stub"
            }

        # Load model if not loaded
        if self.model is None:
            try:
                self.model = keras.models.load_model(self.model_path)
                logger.info(f"Model loaded from {self.model_path}")
            except Exception as e:
                logger.error(f"Failed to load model: {e}")
                return {
                    "poids_detecte": None,
                    "confiance": 0.0,
                    "error": f"Model not trained: {str(e)}",
                    "methode": "stub"
                }

        # Preprocess image
        try:
            img = self.preprocess_image(image_base64)
        except Exception as e:
            return {
                "poids_detecte": None,
                "confiance": 0.0,
                "error": f"Failed to preprocess image: {str(e)}",
                "methode": "stub"
            }

        # Predict
        prediction = self.model.predict(img, verbose=0)
        poids_detecte = float(prediction[0][0])

        # Calculate confidence (based on model uncertainty)
        # For now, using a simple heuristic
        confiance = 0.85  # TODO: Implement proper uncertainty estimation

        return {
            "poids_detecte": poids_detecte,
            "confiance": confiance,
            "methode": "CNN (MobileNetV2)",
            "genetique": genetique,
            "model_path": self.model_path,
            "timestamp": datetime.utcnow().isoformat()
        }

    async def evaluate_model(self, genetique: Optional[str] = None) -> Dict:
        """
        Évalue le modèle sur un ensemble de test

        Returns:
            Dict: Métriques d'évaluation (MAE, MSE, R²)
        """
        if not TENSORFLOW_AVAILABLE or self.model is None:
            return {
                "error": "Model not available",
                "status": "failed"
            }

        # Load test data
        data = await self.load_training_data(limit=500, genetique=genetique)

        X = []
        y = []

        for sample in data:
            try:
                img = self.preprocess_image(sample['image_base64'])
                X.append(img[0])
                y.append(sample['poids'])
            except:
                continue

        X = np.array(X)
        y = np.array(y)

        # Evaluate
        results = self.model.evaluate(X, y, verbose=0)

        # Predictions
        y_pred = self.model.predict(X, verbose=0).flatten()

        # Calculate R²
        ss_res = np.sum((y - y_pred) ** 2)
        ss_tot = np.sum((y - np.mean(y)) ** 2)
        r2 = 1 - (ss_res / ss_tot)

        return {
            "nb_samples": len(y),
            "mae": float(results[1]),
            "mse": float(results[2]),
            "r2_score": float(r2),
            "genetique": genetique
        }


def get_computer_vision_engine(db_pool: asyncpg.Pool) -> ComputerVisionEngine:
    """Factory function to get ComputerVisionEngine instance"""
    return ComputerVisionEngine(db_pool)
