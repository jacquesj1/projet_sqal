--
-- PostgreSQL database dump
--

-- Dumped from database version 15.13
-- Dumped by pg_dump version 15.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: timescaledb; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS timescaledb WITH SCHEMA public;


--
-- Name: EXTENSION timescaledb; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION timescaledb IS 'Enables scalable inserts and complex queries for time-series data (Community Edition)';


--
-- Name: auto_assign_generic_canard(); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.auto_assign_generic_canard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.canard_id IS NULL AND NEW.lot_mais_id IS NOT NULL THEN
        -- Assigner le canard générique du lot
        NEW.canard_id := ensure_generic_canard_for_lot(NEW.lot_mais_id);
        
        -- Aussi copier dans gavage_data_lots
        IF NEW.dose_matin > 0 THEN
            INSERT INTO gavage_data_lots (
                time, lot_gavage_id, jour_gavage, repas,
                dose_moyenne, dose_theorique, poids_moyen_lot,
                nb_canards_vivants, temperature_stabule, humidite_stabule
            )
            SELECT
                NEW.time, NEW.lot_mais_id,
                COALESCE((SELECT jour_actuel FROM lots_gavage WHERE id = NEW.lot_mais_id), 1),
                'matin',
                NEW.dose_matin, NEW.dose_theorique_matin, NEW.poids_actuel,
                (SELECT nb_canards_initial - COALESCE(nb_morts, 0) FROM lots_gavage WHERE id = NEW.lot_mais_id),
                NEW.temperature_stabule, NEW.humidite_stabule
            ON CONFLICT DO NOTHING;
        END IF;
        
        IF NEW.dose_soir > 0 THEN
            INSERT INTO gavage_data_lots (
                time, lot_gavage_id, jour_gavage, repas,
                dose_moyenne, dose_theorique, poids_moyen_lot,
                nb_canards_vivants, temperature_stabule, humidite_stabule
            )
            SELECT
                NEW.time, NEW.lot_mais_id,
                COALESCE((SELECT jour_actuel FROM lots_gavage WHERE id = NEW.lot_mais_id), 1),
                'soir',
                NEW.dose_soir, NEW.dose_theorique_soir, NEW.poids_actuel,
                (SELECT nb_canards_initial - COALESCE(nb_morts, 0) FROM lots_gavage WHERE id = NEW.lot_mais_id),
                NEW.temperature_stabule, NEW.humidite_stabule
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.auto_assign_generic_canard() OWNER TO gaveurs_admin;

--
-- Name: auto_populate_ml_data(); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.auto_populate_ml_data() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_product RECORD;
    v_sqal RECORD;
    v_lot RECORD;
    v_delay_days INTEGER;
BEGIN
    -- Récupérer produit
    SELECT * INTO v_product FROM consumer_products WHERE product_id = NEW.product_id;

    -- Si pas de sample_id SQAL, skip
    IF v_product.sample_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Récupérer données SQAL
    SELECT
        fusion_final_score,
        fusion_final_grade,
        vl53l8ch_volume_mm3,
        vl53l8ch_surface_uniformity,
        as7341_freshness_index,
        as7341_fat_quality_index,
        as7341_oxidation_index
    INTO v_sqal
    FROM sqal_sensor_samples
    WHERE sample_id = v_product.sample_id
    ORDER BY time DESC
    LIMIT 1;

    -- Récupérer données lot
    SELECT
        itm_moyen,
        poids_moyen_final_g,
        taux_mortalite_pct,
        indice_consommation
    INTO v_lot
    FROM lots_gavage
    WHERE id = v_product.lot_id;

    -- Calculer délai consommation
    v_delay_days := COALESCE(NEW.consumption_date - v_product.production_date, 0);

    -- Insérer dans ML data
    INSERT INTO consumer_feedback_ml_data (
        feedback_id,
        lot_id,
        sample_id,
        lot_itm,
        lot_avg_weight,
        lot_mortality_rate,
        lot_feed_conversion,
        sqal_score,
        sqal_grade,
        vl53l8ch_volume_mm3,
        vl53l8ch_surface_uniformity,
        as7341_freshness_index,
        as7341_fat_quality_index,
        as7341_oxidation_index,
        consumer_overall_rating,
        consumer_texture_rating,
        consumer_flavor_rating,
        consumer_freshness_rating,
        consumer_would_recommend,
        site_code,
        production_date,
        consumption_delay_days
    ) VALUES (
        NEW.feedback_id,
        v_product.lot_id,
        v_product.sample_id,
        v_lot.itm_moyen,
        v_lot.poids_moyen_final_g,
        v_lot.taux_mortalite_pct,
        v_lot.indice_consommation,
        v_sqal.fusion_final_score,
        v_sqal.fusion_final_grade,
        v_sqal.vl53l8ch_volume_mm3,
        v_sqal.vl53l8ch_surface_uniformity,
        v_sqal.as7341_freshness_index,
        v_sqal.as7341_fat_quality_index,
        v_sqal.as7341_oxidation_index,
        NEW.overall_rating,
        NEW.texture_rating,
        NEW.flavor_rating,
        NEW.freshness_rating,
        NEW.would_recommend,
        v_product.site_code,
        v_product.production_date,
        v_delay_days
    );

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.auto_populate_ml_data() OWNER TO gaveurs_admin;

--
-- Name: FUNCTION auto_populate_ml_data(); Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON FUNCTION public.auto_populate_ml_data() IS 'Trigger : Auto-remplissage table ML après nouveau feedback';


--
-- Name: calculate_consumption_delay(character varying, date); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.calculate_consumption_delay(p_product_id character varying, p_consumption_date date) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_production_date DATE;
    v_delay_days INTEGER;
BEGIN
    SELECT production_date INTO v_production_date
    FROM consumer_products
    WHERE product_id = p_product_id;

    v_delay_days := p_consumption_date - v_production_date;

    RETURN v_delay_days;
END;
$$;


ALTER FUNCTION public.calculate_consumption_delay(p_product_id character varying, p_consumption_date date) OWNER TO gaveurs_admin;

--
-- Name: FUNCTION calculate_consumption_delay(p_product_id character varying, p_consumption_date date); Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON FUNCTION public.calculate_consumption_delay(p_product_id character varying, p_consumption_date date) IS 'Calcule délai entre production et consommation (jours)';


--
-- Name: calculate_itm_from_sqal(); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.calculate_itm_from_sqal() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    poids_moyen_g DECIMAL(6,2);
    mais_par_canard_g DECIMAL(10,2);
    itm_calcule DECIMAL(6,4);
    nb_mesures INTEGER;
BEGIN
    -- Calculer poids foie moyen pour le lot depuis SQAL
    SELECT
        AVG(poids_foie_estime_g),
        COUNT(*)
    INTO
        poids_moyen_g,
        nb_mesures
    FROM sqal_sensor_samples
    WHERE lot_id = NEW.lot_id
      AND poids_foie_estime_g IS NOT NULL;

    -- Si pas de mesures, sortir
    IF poids_moyen_g IS NULL OR nb_mesures = 0 THEN
        RETURN NEW;
    END IF;

    -- Mettre à jour ITM du lot
    UPDATE lots_gavage
    SET
        itm = (
            -- ITM = poids_foie_moyen / mais_total_par_canard
            poids_moyen_g / NULLIF((total_corn_real / NULLIF(nb_accroches, 0)), 0)
        ),
        updated_at = NOW()
    WHERE id = NEW.lot_id
      AND total_corn_real IS NOT NULL
      AND nb_accroches > 0;

    -- Logger pour debug
    IF FOUND THEN
        RAISE NOTICE 'ITM recalculé pour lot_id=% : poids_moyen=%g, nb_mesures=%',
            NEW.lot_id, poids_moyen_g, nb_mesures;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.calculate_itm_from_sqal() OWNER TO gaveurs_admin;

--
-- Name: FUNCTION calculate_itm_from_sqal(); Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON FUNCTION public.calculate_itm_from_sqal() IS 'Recalcule automatiquement ITM du lot quand nouvelles mesures SQAL arrivent.
Formule: ITM = poids_foie_moyen_g / (total_corn_real / nb_accroches)';


--
-- Name: calculate_nb_morts(); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.calculate_nb_morts() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.nb_morts := ROUND((NEW.nb_meg * NEW.pctg_perte_gavage / 100)::numeric, 0);
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.calculate_nb_morts() OWNER TO gaveurs_admin;

--
-- Name: calculer_ecart_theorique(integer, integer, numeric); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.calculer_ecart_theorique(p_lot_id integer, p_jour integer, p_poids_reel numeric) RETURNS TABLE(poids_theorique numeric, ecart_pourcent numeric)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_courbe JSONB;
    v_point JSONB;
    v_poids_theo DECIMAL;
BEGIN
    SELECT courbe_theorique INTO v_courbe
    FROM lots
    WHERE id = p_lot_id;

    IF v_courbe IS NULL THEN
        RETURN QUERY SELECT NULL::DECIMAL, NULL::DECIMAL;
        RETURN;
    END IF;

    -- Trouver le point correspondant au jour
    SELECT value INTO v_point
    FROM jsonb_array_elements(v_courbe)
    WHERE value->>'jour' = p_jour::TEXT;

    IF v_point IS NULL THEN
        RETURN QUERY SELECT NULL::DECIMAL, NULL::DECIMAL;
        RETURN;
    END IF;

    v_poids_theo := (v_point->>'poids')::DECIMAL;

    RETURN QUERY SELECT
        v_poids_theo,
        ROUND(((p_poids_reel - v_poids_theo) / v_poids_theo) * 100, 2);
END;
$$;


ALTER FUNCTION public.calculer_ecart_theorique(p_lot_id integer, p_jour integer, p_poids_reel numeric) OWNER TO gaveurs_admin;

--
-- Name: calculer_indice_consommation(integer); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.calculer_indice_consommation(p_canard_id integer) RETURNS numeric
    LANGUAGE plpgsql
    AS $$
DECLARE
    total_mais NUMERIC;
    gain_poids NUMERIC;
    poids_final NUMERIC;
    poids_init NUMERIC;
BEGIN
    -- Dose totale de maïs en kg
    SELECT COALESCE(SUM(dose_matin + dose_soir) / 1000.0, 0)
    INTO total_mais
    FROM gavage_data
    WHERE canard_id = p_canard_id;
    
    -- Poids initial et final
    SELECT poids_initial INTO poids_init FROM canards WHERE id = p_canard_id;
    
    SELECT COALESCE(poids_soir, poids_init)
    INTO poids_final
    FROM gavage_data
    WHERE canard_id = p_canard_id
    ORDER BY time DESC
    LIMIT 1;
    
    gain_poids := poids_final - poids_init;
    
    -- IC = kg maïs consommé / kg de gain de poids
    IF gain_poids > 0 THEN
        RETURN total_mais / (gain_poids / 1000.0);
    ELSE
        RETURN NULL;
    END IF;
END;
$$;


ALTER FUNCTION public.calculer_indice_consommation(p_canard_id integer) OWNER TO gaveurs_admin;

--
-- Name: calculer_jour_gavage(integer, date); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.calculer_jour_gavage(p_lot_id integer, p_date_gavage date) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_date_debut DATE;
    v_jour INTEGER;
BEGIN
    SELECT date_debut_gavage INTO v_date_debut
    FROM lots
    WHERE id = p_lot_id;

    IF v_date_debut IS NULL THEN
        RETURN NULL;
    END IF;

    v_jour := (p_date_gavage - v_date_debut) + 1;
    RETURN v_jour;
END;
$$;


ALTER FUNCTION public.calculer_jour_gavage(p_lot_id integer, p_date_gavage date) OWNER TO gaveurs_admin;

--
-- Name: ensure_generic_canard_for_lot(integer); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.ensure_generic_canard_for_lot(p_lot_gavage_id integer) RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_canard_id INTEGER;
    v_code_lot VARCHAR;
BEGIN
    -- Vérifier si un canard générique existe pour ce lot
    SELECT id INTO v_canard_id
    FROM canards
    WHERE numero_identification = 'GENERIC_LOT_' || p_lot_gavage_id::TEXT
    LIMIT 1;
    
    IF v_canard_id IS NULL THEN
        -- Récupérer le code_lot
        SELECT code_lot INTO v_code_lot FROM lots_gavage WHERE id = p_lot_gavage_id;
        
        -- Créer un canard générique pour ce lot dans la table canards
        -- Mais comme canards référence lots (pas lots_gavage), on doit créer un lot dans lots aussi
        
        -- D'abord créer/récupérer un lot dans la table lots
        INSERT INTO lots (
            code_lot, site_origine, nombre_canards, genetique,
            date_debut_gavage, date_fin_gavage_prevue,
            poids_moyen_initial, poids_moyen_actuel,
            objectif_quantite_mais, objectif_poids_final,
            statut, gaveur_id
        )
        SELECT 
            lg.code_lot,
            COALESCE(lg.geo, 'Simulateur'),
            COALESCE(lg.nb_canards_initial, 50),
            COALESCE(lg.souche, 'mulard'),
            lg.debut_lot,
            lg.debut_lot + INTERVAL '14 days',
            4500.00,
            COALESCE(lg.poids_moyen_actuel, 4500.00),
            3000,
            6500,
            'en_gavage',
            15 -- gaveur_id du simulateur
        FROM lots_gavage lg
        WHERE lg.id = p_lot_gavage_id
        ON CONFLICT (code_lot) DO NOTHING;
        
        -- Maintenant créer le canard générique
        INSERT INTO canards (
            numero_identification,
            gaveur_id,
            genetique,
            date_naissance,
            origine_elevage,
            numero_lot_canard,
            poids_initial,
            statut,
            lot_id
        ) VALUES (
            'GENERIC_LOT_' || p_lot_gavage_id::TEXT,
            15,
            'mulard',
            NOW() - INTERVAL '120 days',
            'Simulateur Gavage',
            v_code_lot,
            4500.00,
            'en_gavage',
            (SELECT id FROM lots WHERE code_lot = v_code_lot LIMIT 1)
        )
        RETURNING id INTO v_canard_id;
    END IF;
    
    RETURN v_canard_id;
END;
$$;


ALTER FUNCTION public.ensure_generic_canard_for_lot(p_lot_gavage_id integer) OWNER TO gaveurs_admin;

--
-- Name: extract_site_from_code_lot(); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.extract_site_from_code_lot() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.site_code := LEFT(NEW.code_lot, 2);
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.extract_site_from_code_lot() OWNER TO gaveurs_admin;

--
-- Name: generate_qr_code(integer, character varying, character varying); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.generate_qr_code(p_lot_id integer, p_sample_id character varying DEFAULT NULL::character varying, p_site_code character varying DEFAULT 'LL'::character varying) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_product_id VARCHAR;
    v_qr_code VARCHAR;
    v_signature VARCHAR;
BEGIN
    -- Générer product_id unique : FG_{site}_{date}_{seq}
    v_product_id := 'FG_' || p_site_code || '_' || TO_CHAR(NOW(), 'YYYYMMDD') || '_' ||
                    LPAD(nextval('consumer_products_seq')::TEXT, 4, '0');

    -- Générer signature cryptographique (SHA256)
    v_signature := encode(digest(v_product_id || p_lot_id::TEXT || COALESCE(p_sample_id, '') || NOW()::TEXT, 'sha256'), 'hex');

    -- Construire QR code : SQAL_{lot_id}_{sample_id}_{product_id}_{signature[:16]}
    v_qr_code := 'SQAL_' || p_lot_id || '_' ||
                 COALESCE(p_sample_id, 'NOSAMPLE') || '_' ||
                 v_product_id || '_' ||
                 SUBSTRING(v_signature, 1, 16);

    RETURN v_qr_code;
END;
$$;


ALTER FUNCTION public.generate_qr_code(p_lot_id integer, p_sample_id character varying, p_site_code character varying) OWNER TO gaveurs_admin;

--
-- Name: FUNCTION generate_qr_code(p_lot_id integer, p_sample_id character varying, p_site_code character varying); Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON FUNCTION public.generate_qr_code(p_lot_id integer, p_sample_id character varying, p_site_code character varying) IS 'Génère un QR code unique pour un produit';


--
-- Name: get_lot_timeline_summary(character varying); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.get_lot_timeline_summary(p_lot_id character varying) RETURNS TABLE(event_count bigint, first_event timestamp without time zone, last_event timestamp without time zone, gavage_events bigint, sqal_events bigint, consumer_events bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as event_count,
        MIN(timestamp) as first_event,
        MAX(timestamp) as last_event,
        SUM(CASE WHEN event_type LIKE 'gavage%' THEN 1 ELSE 0 END) as gavage_events,
        SUM(CASE WHEN event_type = 'sqal_control' THEN 1 ELSE 0 END) as sqal_events,
        SUM(CASE WHEN event_type = 'consumer_feedback' THEN 1 ELSE 0 END) as consumer_events
    FROM lot_events
    WHERE lot_id = p_lot_id;
END;
$$;


ALTER FUNCTION public.get_lot_timeline_summary(p_lot_id character varying) OWNER TO gaveurs_admin;

--
-- Name: get_sqal_stats_period(integer, character varying); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.get_sqal_stats_period(p_hours integer DEFAULT 24, p_device_id character varying DEFAULT NULL::character varying) RETURNS TABLE(total_samples bigint, avg_quality numeric, count_a_plus bigint, compliance_rate numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_samples,
        AVG(fusion_final_score) as avg_quality,
        COUNT(*) FILTER (WHERE fusion_final_grade = 'A+') as count_a_plus,
        (COUNT(*) FILTER (WHERE fusion_is_compliant = TRUE)::DECIMAL / COUNT(*) * 100) as compliance_rate
    FROM sqal_sensor_samples
    WHERE time > NOW() - (p_hours || ' hours')::INTERVAL
        AND (p_device_id IS NULL OR device_id = p_device_id);
END;
$$;


ALTER FUNCTION public.get_sqal_stats_period(p_hours integer, p_device_id character varying) OWNER TO gaveurs_admin;

--
-- Name: FUNCTION get_sqal_stats_period(p_hours integer, p_device_id character varying); Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON FUNCTION public.get_sqal_stats_period(p_hours integer, p_device_id character varying) IS 'Statistiques qualité sur une période (défaut 24h)';


--
-- Name: insert_gavage_lot_data(timestamp with time zone, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.insert_gavage_lot_data(p_time timestamp with time zone, p_lot_gavage_id integer, p_dose_matin numeric, p_dose_soir numeric, p_dose_theo_matin numeric, p_dose_theo_soir numeric, p_poids_actuel numeric, p_temperature numeric, p_humidite numeric) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_jour INTEGER;
    v_nb_vivants INTEGER;
BEGIN
    -- Récupérer infos lot
    SELECT jour_actuel, (nb_canards_initial - COALESCE(nb_morts, 0))
    INTO v_jour, v_nb_vivants
    FROM lots_gavage
    WHERE id = p_lot_gavage_id;
    
    -- Insérer matin si dose > 0
    IF p_dose_matin > 0 THEN
        INSERT INTO gavage_data_lots (
            time, lot_gavage_id, jour_gavage, repas,
            dose_moyenne, dose_theorique, poids_moyen_lot,
            nb_canards_vivants, temperature_stabule, humidite_stabule
        ) VALUES (
            p_time, p_lot_gavage_id, COALESCE(v_jour, 1), 'matin',
            p_dose_matin, p_dose_theo_matin, p_poids_actuel,
            v_nb_vivants, p_temperature, p_humidite
        ) ON CONFLICT (time, lot_gavage_id, repas) DO UPDATE SET
            dose_moyenne = EXCLUDED.dose_moyenne,
            poids_moyen_lot = EXCLUDED.poids_moyen_lot,
            nb_canards_vivants = EXCLUDED.nb_canards_vivants;
    END IF;
    
    -- Insérer soir si dose > 0
    IF p_dose_soir > 0 THEN
        INSERT INTO gavage_data_lots (
            time, lot_gavage_id, jour_gavage, repas,
            dose_moyenne, dose_theorique, poids_moyen_lot,
            nb_canards_vivants, temperature_stabule, humidite_stabule
        ) VALUES (
            p_time, p_lot_gavage_id, COALESCE(v_jour, 1), 'soir',
            p_dose_soir, p_dose_theo_soir, p_poids_actuel,
            v_nb_vivants, p_temperature, p_humidite
        ) ON CONFLICT (time, lot_gavage_id, repas) DO UPDATE SET
            dose_moyenne = EXCLUDED.dose_moyenne,
            poids_moyen_lot = EXCLUDED.poids_moyen_lot,
            nb_canards_vivants = EXCLUDED.nb_canards_vivants;
    END IF;
END;
$$;


ALTER FUNCTION public.insert_gavage_lot_data(p_time timestamp with time zone, p_lot_gavage_id integer, p_dose_matin numeric, p_dose_soir numeric, p_dose_theo_matin numeric, p_dose_theo_soir numeric, p_poids_actuel numeric, p_temperature numeric, p_humidite numeric) OWNER TO gaveurs_admin;

--
-- Name: link_feedback_to_lot(character varying, character varying, integer); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.link_feedback_to_lot(p_lot_id character varying, p_feedback_id character varying, p_rating integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_current_count INTEGER;
    v_current_avg FLOAT;
    v_new_avg FLOAT;
BEGIN
    -- Get current feedback count and average
    SELECT
        CARDINALITY(consumer_feedbacks),
        average_rating
    INTO v_current_count, v_current_avg
    FROM lots_registry
    WHERE lot_id = p_lot_id;

    -- Calculate new average
    IF v_current_avg IS NULL THEN
        v_new_avg := p_rating;
    ELSE
        v_new_avg := ((v_current_avg * v_current_count) + p_rating) / (v_current_count + 1);
    END IF;

    -- Update lot
    UPDATE lots_registry
    SET
        consumer_feedbacks = array_append(consumer_feedbacks, p_feedback_id),
        average_rating = v_new_avg,
        updated_at = NOW()
    WHERE lot_id = p_lot_id;

    -- Add event
    INSERT INTO lot_events (lot_id, event_type, data, description)
    VALUES (
        p_lot_id,
        'consumer_feedback',
        jsonb_build_object('feedback_id', p_feedback_id, 'rating', p_rating),
        'Feedback consommateur - Note: ' || p_rating || '/5'
    );
END;
$$;


ALTER FUNCTION public.link_feedback_to_lot(p_lot_id character varying, p_feedback_id character varying, p_rating integer) OWNER TO gaveurs_admin;

--
-- Name: link_sqal_to_lot(character varying, character varying, character varying); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.link_sqal_to_lot(p_lot_id character varying, p_sample_id character varying, p_grade character varying) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE lots_registry
    SET
        sqal_samples = array_append(sqal_samples, p_sample_id),
        sqal_grades = array_append(sqal_grades, p_grade),
        updated_at = NOW()
    WHERE lot_id = p_lot_id;

    INSERT INTO lot_events (lot_id, event_type, data, description)
    VALUES (
        p_lot_id,
        'sqal_control',
        jsonb_build_object('sample_id', p_sample_id, 'grade', p_grade),
        'Contrôle qualité SQAL - Grade: ' || p_grade
    );
END;
$$;


ALTER FUNCTION public.link_sqal_to_lot(p_lot_id character varying, p_sample_id character varying, p_grade character varying) OWNER TO gaveurs_admin;

--
-- Name: redirect_gavage_to_lots(); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.redirect_gavage_to_lots() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    lot_id INTEGER;
    jour_actuel_val INTEGER;
    nb_vivants_val INTEGER;
BEGIN
    -- Si canard_id est NULL, c'est une insertion au niveau LOT
    IF NEW.canard_id IS NULL THEN
        -- Récupérer le lot_gavage_id depuis lot_mais_id
        lot_id := NEW.lot_mais_id;
        
        -- Récupérer infos du lot
        SELECT lg.jour_actuel, (lg.nb_canards_initial - COALESCE(lg.nb_morts, 0))
        INTO jour_actuel_val, nb_vivants_val
        FROM lots_gavage lg
        WHERE lg.id = lot_id;
        
        -- Insérer MATIN si dose_matin > 0
        IF NEW.dose_matin > 0 THEN
            INSERT INTO gavage_data_lots (
                time, lot_gavage_id, jour_gavage, repas,
                dose_moyenne, dose_theorique, poids_moyen_lot,
                nb_canards_vivants, temperature_stabule, humidite_stabule
            ) VALUES (
                NEW.time, lot_id, COALESCE(jour_actuel_val, 1), 'matin',
                NEW.dose_matin, NEW.dose_theorique_matin, NEW.poids_actuel,
                nb_vivants_val, NEW.temperature_stabule, NEW.humidite_stabule
            ) ON CONFLICT (time, lot_gavage_id, repas) DO UPDATE SET
                dose_moyenne = EXCLUDED.dose_moyenne,
                poids_moyen_lot = EXCLUDED.poids_moyen_lot;
        END IF;
        
        -- Insérer SOIR si dose_soir > 0
        IF NEW.dose_soir > 0 THEN
            INSERT INTO gavage_data_lots (
                time, lot_gavage_id, jour_gavage, repas,
                dose_moyenne, dose_theorique, poids_moyen_lot,
                nb_canards_vivants, temperature_stabule, humidite_stabule
            ) VALUES (
                NEW.time, lot_id, COALESCE(jour_actuel_val, 1), 'soir',
                NEW.dose_soir, NEW.dose_theorique_soir, NEW.poids_actuel,
                nb_vivants_val, NEW.temperature_stabule, NEW.humidite_stabule
            ) ON CONFLICT (time, lot_gavage_id, repas) DO UPDATE SET
                dose_moyenne = EXCLUDED.dose_moyenne,
                poids_moyen_lot = EXCLUDED.poids_moyen_lot;
        END IF;
        
        -- Ne pas insérer dans gavage_data
        RETURN NULL;
    END IF;
    
    -- Insertion normale pour canards individuels
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.redirect_gavage_to_lots() OWNER TO gaveurs_admin;

--
-- Name: refresh_bug_metrics(); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.refresh_bug_metrics() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO bug_metrics (
        date,
        total_bugs,
        open_bugs,
        in_progress_bugs,
        resolved_bugs,
        closed_bugs,
        critical_bugs,
        high_severity_bugs,
        medium_severity_bugs,
        low_severity_bugs,
        new_bugs_today,
        resolved_today
    )
    SELECT
        CURRENT_DATE,
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'open'),
        COUNT(*) FILTER (WHERE status = 'in_progress'),
        COUNT(*) FILTER (WHERE status = 'resolved'),
        COUNT(*) FILTER (WHERE status = 'closed'),
        COUNT(*) FILTER (WHERE severity = 'critical'),
        COUNT(*) FILTER (WHERE severity = 'high'),
        COUNT(*) FILTER (WHERE severity = 'medium'),
        COUNT(*) FILTER (WHERE severity = 'low'),
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE),
        COUNT(*) FILTER (WHERE DATE(resolved_at) = CURRENT_DATE)
    FROM bug_reports
    ON CONFLICT (date) DO UPDATE SET
        total_bugs = EXCLUDED.total_bugs,
        open_bugs = EXCLUDED.open_bugs,
        in_progress_bugs = EXCLUDED.in_progress_bugs,
        resolved_bugs = EXCLUDED.resolved_bugs,
        closed_bugs = EXCLUDED.closed_bugs,
        critical_bugs = EXCLUDED.critical_bugs,
        high_severity_bugs = EXCLUDED.high_severity_bugs,
        medium_severity_bugs = EXCLUDED.medium_severity_bugs,
        low_severity_bugs = EXCLUDED.low_severity_bugs,
        new_bugs_today = EXCLUDED.new_bugs_today,
        resolved_today = EXCLUDED.resolved_today;
END;
$$;


ALTER FUNCTION public.refresh_bug_metrics() OWNER TO gaveurs_admin;

--
-- Name: refresh_performances_sites(); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.refresh_performances_sites() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY performances_sites;
END;
$$;


ALTER FUNCTION public.refresh_performances_sites() OWNER TO gaveurs_admin;

--
-- Name: FUNCTION refresh_performances_sites(); Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON FUNCTION public.refresh_performances_sites() IS 'Rafraîchit la vue matérialisée des performances par site';


--
-- Name: refresh_stats_lots(); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.refresh_stats_lots() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY stats_lots;
END;
$$;


ALTER FUNCTION public.refresh_stats_lots() OWNER TO gaveurs_admin;

--
-- Name: register_consumer_product(integer, character varying, character varying); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.register_consumer_product(p_lot_id integer, p_sample_id character varying, p_site_code character varying) RETURNS TABLE(product_id character varying, qr_code character varying)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_product_id VARCHAR;
    v_qr_code VARCHAR;
    v_signature VARCHAR;
    v_sqal_data RECORD;
    v_lot_data RECORD;
BEGIN
    -- Récupérer données SQAL
    SELECT
        fusion_final_score,
        fusion_final_grade,
        fusion_is_compliant,
        vl53l8ch_volume_mm3,
        vl53l8ch_surface_uniformity,
        as7341_freshness_index
    INTO v_sqal_data
    FROM sqal_sensor_samples
    WHERE sample_id = p_sample_id
    ORDER BY time DESC
    LIMIT 1;

    -- Récupérer données lot
    SELECT
        l.code_lot,
        l.itm_moyen,
        l.poids_moyen_final_g,
        l.date_debut_gavage,
        l.date_fin_prevue_gavage,
        EXTRACT(EPOCH FROM (l.date_fin_prevue_gavage - l.date_debut_gavage)) / 86400 as duration_days
    INTO v_lot_data
    FROM lots_gavage l
    WHERE l.id = p_lot_id;

    -- Générer QR code
    v_qr_code := generate_qr_code(p_lot_id, p_sample_id, p_site_code);

    -- Extraire product_id du QR code
    v_product_id := SPLIT_PART(v_qr_code, '_', 4);

    -- Extraire signature
    v_signature := SPLIT_PART(v_qr_code, '_', 5);

    -- Insérer produit
    INSERT INTO consumer_products (
        product_id,
        qr_code,
        qr_signature,
        lot_id,
        sample_id,
        site_code,
        production_date,
        quality_control_date,
        sqal_quality_score,
        sqal_grade,
        sqal_compliance,
        lot_itm,
        lot_avg_weight,
        gavage_duration_days,
        certifications,
        production_method
    ) VALUES (
        v_product_id,
        v_qr_code,
        v_signature,
        p_lot_id,
        p_sample_id,
        p_site_code,
        CURRENT_DATE,
        NOW(),
        v_sqal_data.fusion_final_score,
        v_sqal_data.fusion_final_grade,
        v_sqal_data.fusion_is_compliant,
        v_lot_data.itm_moyen,
        v_lot_data.poids_moyen_final_g,
        v_lot_data.duration_days,
        '["IGP Périgord"]'::jsonb,
        'traditionnel'
    );

    RETURN QUERY SELECT v_product_id, v_qr_code;
END;
$$;


ALTER FUNCTION public.register_consumer_product(p_lot_id integer, p_sample_id character varying, p_site_code character varying) OWNER TO gaveurs_admin;

--
-- Name: FUNCTION register_consumer_product(p_lot_id integer, p_sample_id character varying, p_site_code character varying); Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON FUNCTION public.register_consumer_product(p_lot_id integer, p_sample_id character varying, p_site_code character varying) IS 'Enregistre un produit après contrôle SQAL et génère QR code';


--
-- Name: update_lots_updated_at(); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.update_lots_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_lots_updated_at() OWNER TO gaveurs_admin;

--
-- Name: update_poids_moyen_lot(); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.update_poids_moyen_lot() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE lots
    SET
        poids_moyen_actuel = NEW.poids_moyen_mesure,
        nombre_jours_gavage_ecoules = NEW.jour_gavage,
        nombre_mortalite = nombre_mortalite + COALESCE(NEW.mortalite_jour, 0)
    WHERE id = NEW.lot_id;

    -- Mettre à jour le taux de mortalité
    UPDATE lots
    SET taux_mortalite = ROUND((nombre_mortalite::DECIMAL / nombre_canards) * 100, 2)
    WHERE id = NEW.lot_id;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_poids_moyen_lot() OWNER TO gaveurs_admin;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: gaveurs_admin
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO gaveurs_admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _compressed_hypertable_11; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._compressed_hypertable_11 (
);


ALTER TABLE _timescaledb_internal._compressed_hypertable_11 OWNER TO gaveurs_admin;

--
-- Name: _compressed_hypertable_13; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._compressed_hypertable_13 (
);


ALTER TABLE _timescaledb_internal._compressed_hypertable_13 OWNER TO gaveurs_admin;

--
-- Name: _compressed_hypertable_20; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._compressed_hypertable_20 (
);


ALTER TABLE _timescaledb_internal._compressed_hypertable_20 OWNER TO gaveurs_admin;

--
-- Name: _compressed_hypertable_21; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._compressed_hypertable_21 (
);


ALTER TABLE _timescaledb_internal._compressed_hypertable_21 OWNER TO gaveurs_admin;

--
-- Name: _compressed_hypertable_3; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._compressed_hypertable_3 (
);


ALTER TABLE _timescaledb_internal._compressed_hypertable_3 OWNER TO gaveurs_admin;

--
-- Name: _compressed_hypertable_4; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._compressed_hypertable_4 (
);


ALTER TABLE _timescaledb_internal._compressed_hypertable_4 OWNER TO gaveurs_admin;

--
-- Name: _compressed_hypertable_6; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._compressed_hypertable_6 (
);


ALTER TABLE _timescaledb_internal._compressed_hypertable_6 OWNER TO gaveurs_admin;

--
-- Name: consumer_feedbacks; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.consumer_feedbacks (
    "time" timestamp with time zone NOT NULL,
    feedback_id integer NOT NULL,
    product_id character varying(100) NOT NULL,
    overall_rating smallint NOT NULL,
    texture_rating smallint,
    flavor_rating smallint,
    color_rating smallint,
    aroma_rating smallint,
    freshness_rating smallint,
    comment text,
    consumption_context character varying(50),
    consumption_date date,
    consumer_age_range character varying(20),
    consumer_region character varying(100),
    would_recommend boolean,
    repurchase_intent smallint,
    photo_urls jsonb DEFAULT '[]'::jsonb,
    device_type character varying(50),
    app_version character varying(20),
    ip_hash character varying(64),
    is_verified boolean DEFAULT false,
    is_moderated boolean DEFAULT false,
    is_public boolean DEFAULT true,
    moderation_notes text,
    reward_points_granted integer DEFAULT 0,
    CONSTRAINT consumer_feedbacks_aroma_rating_check CHECK (((aroma_rating >= 1) AND (aroma_rating <= 5))),
    CONSTRAINT consumer_feedbacks_color_rating_check CHECK (((color_rating >= 1) AND (color_rating <= 5))),
    CONSTRAINT consumer_feedbacks_flavor_rating_check CHECK (((flavor_rating >= 1) AND (flavor_rating <= 5))),
    CONSTRAINT consumer_feedbacks_freshness_rating_check CHECK (((freshness_rating >= 1) AND (freshness_rating <= 5))),
    CONSTRAINT consumer_feedbacks_overall_rating_check CHECK (((overall_rating >= 1) AND (overall_rating <= 5))),
    CONSTRAINT consumer_feedbacks_repurchase_intent_check CHECK (((repurchase_intent >= 1) AND (repurchase_intent <= 5))),
    CONSTRAINT consumer_feedbacks_texture_rating_check CHECK (((texture_rating >= 1) AND (texture_rating <= 5)))
);


ALTER TABLE public.consumer_feedbacks OWNER TO gaveurs_admin;

--
-- Name: TABLE consumer_feedbacks; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.consumer_feedbacks IS 'Feedbacks consommateurs collectés via QR code';


--
-- Name: consumer_products; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.consumer_products (
    product_id character varying(100) NOT NULL,
    qr_code character varying(200) NOT NULL,
    qr_signature character varying(64) NOT NULL,
    lot_id integer,
    sample_id character varying(100),
    site_code character varying(2),
    production_date date NOT NULL,
    quality_control_date timestamp with time zone,
    packaging_date date,
    best_before_date date,
    sqal_quality_score numeric(5,4),
    sqal_grade character varying(10),
    sqal_compliance boolean DEFAULT true,
    lot_itm numeric(6,2),
    lot_avg_weight numeric(8,2),
    gavage_duration_days integer,
    certifications jsonb DEFAULT '[]'::jsonb,
    production_method character varying(50) DEFAULT 'traditionnel'::character varying,
    carbon_footprint_kg numeric(6,2),
    animal_welfare_score numeric(5,4),
    blockchain_hash character varying(128),
    blockchain_verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true
);


ALTER TABLE public.consumer_products OWNER TO gaveurs_admin;

--
-- Name: TABLE consumer_products; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.consumer_products IS 'Produits finaux avec QR code pour traçabilité consommateur';


--
-- Name: _direct_view_14; Type: VIEW; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE VIEW _timescaledb_internal._direct_view_14 AS
 SELECT public.time_bucket('1 day'::interval, f."time") AS bucket,
    p.lot_id,
    p.site_code,
    count(f.feedback_id) AS daily_feedbacks,
    avg(f.overall_rating) AS avg_overall_rating,
    avg(f.texture_rating) AS avg_texture_rating,
    avg(f.flavor_rating) AS avg_flavor_rating,
    avg(f.freshness_rating) AS avg_freshness_rating,
    (((count(*) FILTER (WHERE (f.would_recommend = true)))::double precision / (NULLIF(count(*), 0))::double precision) * (100)::double precision) AS recommendation_rate_pct,
    (((count(*) FILTER (WHERE (f.overall_rating >= 4)))::double precision / (NULLIF(count(*), 0))::double precision) * (100)::double precision) AS satisfaction_rate_pct
   FROM (public.consumer_feedbacks f
     JOIN public.consumer_products p ON (((f.product_id)::text = (p.product_id)::text)))
  WHERE (f.is_public = true)
  GROUP BY (public.time_bucket('1 day'::interval, f."time")), p.lot_id, p.site_code;


ALTER TABLE _timescaledb_internal._direct_view_14 OWNER TO gaveurs_admin;

--
-- Name: _direct_view_15; Type: VIEW; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE VIEW _timescaledb_internal._direct_view_15 AS
 SELECT public.time_bucket('7 days'::interval, f."time") AS bucket,
    p.site_code,
    count(f.feedback_id) AS weekly_feedbacks,
    avg(f.overall_rating) AS avg_overall_rating,
    avg(f.texture_rating) AS avg_texture_rating,
    avg(f.flavor_rating) AS avg_flavor_rating,
    avg(f.color_rating) AS avg_color_rating,
    avg(f.aroma_rating) AS avg_aroma_rating,
    avg(f.freshness_rating) AS avg_freshness_rating,
    (((count(*) FILTER (WHERE (f.would_recommend = true)))::double precision / (NULLIF(count(*), 0))::double precision) * (100)::double precision) AS recommendation_rate_pct,
    (((count(*) FILTER (WHERE (f.overall_rating >= 4)))::double precision / (NULLIF(count(*), 0))::double precision) * (100)::double precision) AS satisfaction_rate_pct,
    ((((count(*) FILTER (WHERE (f.overall_rating = 5)))::double precision / (NULLIF(count(*), 0))::double precision) * (100)::double precision) - (((count(*) FILTER (WHERE (f.overall_rating <= 2)))::double precision / (NULLIF(count(*), 0))::double precision) * (100)::double precision)) AS nps_score
   FROM (public.consumer_feedbacks f
     JOIN public.consumer_products p ON (((f.product_id)::text = (p.product_id)::text)))
  WHERE (f.is_public = true)
  GROUP BY (public.time_bucket('7 days'::interval, f."time")), p.site_code;


ALTER TABLE _timescaledb_internal._direct_view_15 OWNER TO gaveurs_admin;

--
-- Name: sqal_sensor_samples; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.sqal_sensor_samples (
    "time" timestamp with time zone NOT NULL,
    sample_id character varying(100) NOT NULL,
    device_id character varying(100) NOT NULL,
    lot_id integer,
    vl53l8ch_distance_matrix jsonb NOT NULL,
    vl53l8ch_reflectance_matrix jsonb NOT NULL,
    vl53l8ch_amplitude_matrix jsonb NOT NULL,
    vl53l8ch_integration_time integer,
    vl53l8ch_temperature_c numeric(5,2),
    vl53l8ch_volume_mm3 numeric(10,2),
    vl53l8ch_avg_height_mm numeric(6,2),
    vl53l8ch_max_height_mm numeric(6,2),
    vl53l8ch_min_height_mm numeric(6,2),
    vl53l8ch_surface_uniformity numeric(5,4),
    vl53l8ch_bins_analysis jsonb,
    vl53l8ch_reflectance_analysis jsonb,
    vl53l8ch_amplitude_consistency jsonb,
    vl53l8ch_quality_score numeric(5,4),
    vl53l8ch_grade character varying(10),
    vl53l8ch_score_breakdown jsonb,
    vl53l8ch_defects jsonb,
    as7341_channels jsonb NOT NULL,
    as7341_integration_time integer,
    as7341_gain integer,
    as7341_freshness_index numeric(5,4),
    as7341_fat_quality_index numeric(5,4),
    as7341_oxidation_index numeric(5,4),
    as7341_spectral_analysis jsonb,
    as7341_color_analysis jsonb,
    as7341_quality_score numeric(5,4),
    as7341_grade character varying(10),
    as7341_score_breakdown jsonb,
    as7341_defects jsonb,
    fusion_final_score numeric(5,4) NOT NULL,
    fusion_final_grade character varying(10) NOT NULL,
    fusion_vl53l8ch_score numeric(5,4),
    fusion_as7341_score numeric(5,4),
    fusion_defects jsonb,
    fusion_is_compliant boolean DEFAULT true,
    meta_firmware_version character varying(20),
    meta_temperature_c numeric(5,2),
    meta_humidity_percent numeric(5,2),
    meta_config_profile character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    poids_foie_estime_g numeric(6,2)
);


ALTER TABLE public.sqal_sensor_samples OWNER TO gaveurs_admin;

--
-- Name: TABLE sqal_sensor_samples; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.sqal_sensor_samples IS 'Mesures capteurs ToF + Spectral avec analyses (Hypertable)';


--
-- Name: COLUMN sqal_sensor_samples.lot_id; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.sqal_sensor_samples.lot_id IS 'Lien optionnel avec lots Euralis pour corrélation ITM ↔ Qualité';


--
-- Name: COLUMN sqal_sensor_samples.vl53l8ch_distance_matrix; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.sqal_sensor_samples.vl53l8ch_distance_matrix IS 'Matrice 8x8 distances (mm) format JSONB';


--
-- Name: COLUMN sqal_sensor_samples.fusion_final_score; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.sqal_sensor_samples.fusion_final_score IS 'Score fusion = 0.6*VL + 0.4*AS7341';


--
-- Name: COLUMN sqal_sensor_samples.poids_foie_estime_g; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.sqal_sensor_samples.poids_foie_estime_g IS 'Poids du foie calculé depuis volume ToF (g): masse = (volume_mm³ / 1000) × 0.947 g/cm³
Source scientifique: Int. J. Food Properties (2016) - Thermal properties of duck foie gras
Densité foie gras cru à 20°C: 947 kg/m³ = 0.947 g/cm³';


--
-- Name: _direct_view_17; Type: VIEW; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE VIEW _timescaledb_internal._direct_view_17 AS
 SELECT public.time_bucket('01:00:00'::interval, sqal_sensor_samples."time") AS bucket,
    sqal_sensor_samples.device_id,
    count(*) AS sample_count,
    count(*) FILTER (WHERE ((sqal_sensor_samples.fusion_final_grade)::text = 'A+'::text)) AS count_a_plus,
    count(*) FILTER (WHERE ((sqal_sensor_samples.fusion_final_grade)::text = 'A'::text)) AS count_a,
    count(*) FILTER (WHERE ((sqal_sensor_samples.fusion_final_grade)::text = 'B'::text)) AS count_b,
    count(*) FILTER (WHERE ((sqal_sensor_samples.fusion_final_grade)::text = 'C'::text)) AS count_c,
    count(*) FILTER (WHERE ((sqal_sensor_samples.fusion_final_grade)::text = 'REJECT'::text)) AS count_reject,
    avg(sqal_sensor_samples.fusion_final_score) AS avg_quality_score,
    min(sqal_sensor_samples.fusion_final_score) AS min_quality_score,
    max(sqal_sensor_samples.fusion_final_score) AS max_quality_score,
    avg(sqal_sensor_samples.as7341_freshness_index) AS avg_freshness,
    avg(sqal_sensor_samples.as7341_fat_quality_index) AS avg_fat_quality,
    avg(sqal_sensor_samples.as7341_oxidation_index) AS avg_oxidation,
    avg(sqal_sensor_samples.vl53l8ch_volume_mm3) AS avg_volume,
    avg(sqal_sensor_samples.vl53l8ch_surface_uniformity) AS avg_uniformity,
    count(*) FILTER (WHERE (sqal_sensor_samples.fusion_is_compliant = true)) AS count_compliant,
    now() AS last_refresh
   FROM public.sqal_sensor_samples
  GROUP BY (public.time_bucket('01:00:00'::interval, sqal_sensor_samples."time")), sqal_sensor_samples.device_id;


ALTER TABLE _timescaledb_internal._direct_view_17 OWNER TO gaveurs_admin;

--
-- Name: sqal_devices; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.sqal_devices (
    device_id character varying(100) NOT NULL,
    device_name character varying(200),
    device_type character varying(50) DEFAULT 'ESP32'::character varying,
    firmware_version character varying(20),
    site_code character varying(2),
    status character varying(20) DEFAULT 'active'::character varying,
    last_seen timestamp with time zone,
    config_profile character varying(50),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.sqal_devices OWNER TO gaveurs_admin;

--
-- Name: TABLE sqal_devices; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.sqal_devices IS 'Devices ESP32 avec capteurs VL53L8CH + AS7341';


--
-- Name: COLUMN sqal_devices.site_code; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.sqal_devices.site_code IS 'Lien avec sites Euralis (LL/LS/MT)';


--
-- Name: _direct_view_18; Type: VIEW; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE VIEW _timescaledb_internal._direct_view_18 AS
 SELECT public.time_bucket('1 day'::interval, s."time") AS day,
    d.site_code,
    count(*) AS sample_count,
    count(*) FILTER (WHERE ((s.fusion_final_grade)::text = 'A+'::text)) AS count_a_plus,
    avg(s.fusion_final_score) AS avg_quality_score,
    avg(s.as7341_freshness_index) AS avg_freshness,
    (((count(*) FILTER (WHERE (s.fusion_is_compliant = true)))::double precision / (count(*))::double precision) * (100)::double precision) AS compliance_rate_pct,
    now() AS last_refresh
   FROM (public.sqal_sensor_samples s
     JOIN public.sqal_devices d ON (((s.device_id)::text = (d.device_id)::text)))
  WHERE (d.site_code IS NOT NULL)
  GROUP BY (public.time_bucket('1 day'::interval, s."time")), d.site_code;


ALTER TABLE _timescaledb_internal._direct_view_18 OWNER TO gaveurs_admin;

--
-- Name: gavage_lot_quotidien; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.gavage_lot_quotidien (
    id integer NOT NULL,
    lot_id integer NOT NULL,
    date_gavage date NOT NULL,
    jour_gavage integer NOT NULL,
    dose_matin numeric(8,2) NOT NULL,
    dose_soir numeric(8,2) NOT NULL,
    dose_totale_jour numeric(8,2) GENERATED ALWAYS AS ((dose_matin + dose_soir)) STORED,
    heure_gavage_matin time without time zone NOT NULL,
    heure_gavage_soir time without time zone NOT NULL,
    nb_canards_peses integer NOT NULL,
    poids_echantillon jsonb NOT NULL,
    poids_moyen_mesure numeric(8,2) NOT NULL,
    gain_poids_jour numeric(8,2),
    gain_poids_cumule numeric(8,2),
    temperature_stabule numeric(5,2),
    humidite_stabule numeric(5,2),
    dose_theorique_matin numeric(8,2),
    dose_theorique_soir numeric(8,2),
    poids_theorique numeric(8,2),
    ecart_dose_pourcent numeric(6,2),
    ecart_poids_pourcent numeric(6,2),
    suit_courbe_theorique boolean DEFAULT true,
    raison_ecart text,
    remarques text,
    mortalite_jour integer DEFAULT 0,
    cause_mortalite text,
    problemes_sante text,
    alerte_generee boolean DEFAULT false,
    niveau_alerte character varying(20),
    recommandations_ia jsonb,
    prediction_activee boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT gavage_lot_quotidien_dose_matin_check CHECK ((dose_matin >= (0)::numeric)),
    CONSTRAINT gavage_lot_quotidien_dose_soir_check CHECK ((dose_soir >= (0)::numeric)),
    CONSTRAINT gavage_lot_quotidien_nb_canards_peses_check CHECK ((nb_canards_peses > 0)),
    CONSTRAINT gavage_lot_quotidien_niveau_alerte_check CHECK (((niveau_alerte)::text = ANY ((ARRAY['info'::character varying, 'warning'::character varying, 'critique'::character varying])::text[]))),
    CONSTRAINT gavage_lot_quotidien_poids_moyen_mesure_check CHECK ((poids_moyen_mesure > (0)::numeric)),
    CONSTRAINT valid_poids_sample CHECK ((jsonb_array_length(poids_echantillon) = nb_canards_peses))
);


ALTER TABLE public.gavage_lot_quotidien OWNER TO gaveurs_admin;

--
-- Name: TABLE gavage_lot_quotidien; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.gavage_lot_quotidien IS 'Hypertable TimescaleDB stockant les données quotidiennes de gavage par LOT. Les doses sont communes à tout le lot.';


--
-- Name: COLUMN gavage_lot_quotidien.poids_echantillon; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.gavage_lot_quotidien.poids_echantillon IS 'JSONB Array contenant les poids individuels d''un échantillon de canards pesés (ex: 10 sur 200).';


--
-- Name: COLUMN gavage_lot_quotidien.recommandations_ia; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.gavage_lot_quotidien.recommandations_ia IS 'JSONB Array des recommandations générées par l''IA (Random Forest + Prophet) quand écart > seuil.';


--
-- Name: _direct_view_23; Type: VIEW; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE VIEW _timescaledb_internal._direct_view_23 AS
 SELECT gavage_lot_quotidien.lot_id,
    public.time_bucket('1 day'::interval, gavage_lot_quotidien.date_gavage) AS jour,
    avg(gavage_lot_quotidien.poids_moyen_mesure) AS poids_moyen,
    avg(gavage_lot_quotidien.dose_totale_jour) AS dose_moyenne,
    avg(gavage_lot_quotidien.temperature_stabule) AS temperature_moyenne,
    avg(gavage_lot_quotidien.humidite_stabule) AS humidite_moyenne,
    avg(gavage_lot_quotidien.ecart_poids_pourcent) AS ecart_moyen,
    sum(gavage_lot_quotidien.mortalite_jour) AS mortalite_totale,
    count(*) AS nombre_enregistrements,
    sum(
        CASE
            WHEN gavage_lot_quotidien.alerte_generee THEN 1
            ELSE 0
        END) AS nombre_alertes
   FROM public.gavage_lot_quotidien
  GROUP BY gavage_lot_quotidien.lot_id, (public.time_bucket('1 day'::interval, gavage_lot_quotidien.date_gavage));


ALTER TABLE _timescaledb_internal._direct_view_23 OWNER TO gaveurs_admin;

--
-- Name: gavage_data; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.gavage_data (
    "time" timestamp with time zone NOT NULL,
    canard_id integer NOT NULL,
    dose_matin numeric(6,2) NOT NULL,
    dose_soir numeric(6,2) NOT NULL,
    dose_theorique_matin numeric(6,2),
    dose_theorique_soir numeric(6,2),
    heure_gavage_matin time without time zone NOT NULL,
    heure_gavage_soir time without time zone NOT NULL,
    poids_matin numeric(6,2),
    poids_soir numeric(6,2),
    temperature_stabule numeric(4,1) NOT NULL,
    humidite_stabule numeric(5,2),
    qualite_air_co2 numeric(6,1),
    luminosite numeric(6,1),
    lot_mais_id integer NOT NULL,
    remarques text,
    comportement_observe text,
    etat_sanitaire text,
    correction_proposee text,
    ecart_dose_matin numeric(6,2),
    ecart_dose_soir numeric(6,2),
    alerte_generee boolean DEFAULT false,
    poids_actuel numeric(6,2),
    CONSTRAINT gavage_data_dose_matin_check CHECK ((dose_matin >= (0)::numeric)),
    CONSTRAINT gavage_data_dose_soir_check CHECK ((dose_soir >= (0)::numeric)),
    CONSTRAINT gavage_data_humidite_stabule_check CHECK (((humidite_stabule >= (0)::numeric) AND (humidite_stabule <= (100)::numeric))),
    CONSTRAINT gavage_data_poids_matin_check CHECK ((poids_matin >= (0)::numeric)),
    CONSTRAINT gavage_data_poids_soir_check CHECK ((poids_soir >= (0)::numeric)),
    CONSTRAINT gavage_data_temperature_stabule_check CHECK (((temperature_stabule >= ('-20'::integer)::numeric) AND (temperature_stabule <= (50)::numeric)))
);


ALTER TABLE public.gavage_data OWNER TO gaveurs_admin;

--
-- Name: TABLE gavage_data; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.gavage_data IS 'Hypertable principale des données de gavage avec séries temporelles';


--
-- Name: _direct_view_7; Type: VIEW; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE VIEW _timescaledb_internal._direct_view_7 AS
 SELECT public.time_bucket('1 day'::interval, gavage_data."time") AS day,
    gavage_data.canard_id,
    avg(gavage_data.poids_matin) AS poids_moyen_matin,
    avg(gavage_data.poids_soir) AS poids_moyen_soir,
    avg((gavage_data.poids_soir - gavage_data.poids_matin)) AS gain_poids_moyen,
    sum((gavage_data.dose_matin + gavage_data.dose_soir)) AS dose_totale_jour,
    avg(gavage_data.temperature_stabule) AS temperature_moyenne,
    avg(gavage_data.humidite_stabule) AS humidite_moyenne,
    count(*) AS nb_mesures
   FROM public.gavage_data
  GROUP BY (public.time_bucket('1 day'::interval, gavage_data."time")), gavage_data.canard_id;


ALTER TABLE _timescaledb_internal._direct_view_7 OWNER TO gaveurs_admin;

--
-- Name: canards; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.canards (
    id integer NOT NULL,
    numero_identification character varying(50) NOT NULL,
    gaveur_id integer NOT NULL,
    genetique character varying(20) NOT NULL,
    date_naissance timestamp with time zone NOT NULL,
    origine_elevage character varying(200) NOT NULL,
    numero_lot_canard character varying(50) NOT NULL,
    poids_initial numeric(6,2) NOT NULL,
    statut character varying(20) DEFAULT 'en_gavage'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    lot_id integer,
    CONSTRAINT canards_genetique_check CHECK (((genetique)::text = ANY ((ARRAY['mulard'::character varying, 'barbarie'::character varying, 'pekin'::character varying, 'mixte'::character varying])::text[]))),
    CONSTRAINT canards_poids_initial_check CHECK ((poids_initial >= (0)::numeric)),
    CONSTRAINT canards_statut_check CHECK (((statut)::text = ANY ((ARRAY['en_gavage'::character varying, 'termine'::character varying, 'decede'::character varying])::text[])))
);


ALTER TABLE public.canards OWNER TO gaveurs_admin;

--
-- Name: COLUMN canards.lot_id; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.canards.lot_id IS 'Référence au lot auquel appartient ce canard. Le gaveur gère des LOTS, pas des canards individuels.';


--
-- Name: _direct_view_8; Type: VIEW; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE VIEW _timescaledb_internal._direct_view_8 AS
 SELECT public.time_bucket('7 days'::interval, gd."time") AS week,
    c.genetique,
    count(DISTINCT gd.canard_id) AS nombre_canards,
    avg((gd.poids_soir - gd.poids_matin)) AS gain_poids_moyen,
    avg((gd.dose_matin + gd.dose_soir)) AS dose_moyenne_totale,
    avg(gd.temperature_stabule) AS temperature_moyenne
   FROM (public.gavage_data gd
     JOIN public.canards c ON ((gd.canard_id = c.id)))
  GROUP BY (public.time_bucket('7 days'::interval, gd."time")), c.genetique;


ALTER TABLE _timescaledb_internal._direct_view_8 OWNER TO gaveurs_admin;

--
-- Name: _hyper_16_27_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._hyper_16_27_chunk (
    CONSTRAINT constraint_26 CHECK ((("time" >= '2026-01-01 00:00:00+00'::timestamp with time zone) AND ("time" < '2026-01-08 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.sqal_sensor_samples);


ALTER TABLE _timescaledb_internal._hyper_16_27_chunk OWNER TO gaveurs_admin;

--
-- Name: _materialized_hypertable_17; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._materialized_hypertable_17 (
    bucket timestamp with time zone NOT NULL,
    device_id character varying(100),
    sample_count bigint,
    count_a_plus bigint,
    count_a bigint,
    count_b bigint,
    count_c bigint,
    count_reject bigint,
    avg_quality_score numeric,
    min_quality_score numeric,
    max_quality_score numeric,
    avg_freshness numeric,
    avg_fat_quality numeric,
    avg_oxidation numeric,
    avg_volume numeric,
    avg_uniformity numeric,
    count_compliant bigint,
    last_refresh timestamp with time zone
);


ALTER TABLE _timescaledb_internal._materialized_hypertable_17 OWNER TO gaveurs_admin;

--
-- Name: _hyper_17_28_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._hyper_17_28_chunk (
    CONSTRAINT constraint_27 CHECK (((bucket >= '2025-12-18 00:00:00+00'::timestamp with time zone) AND (bucket < '2026-02-26 00:00:00+00'::timestamp with time zone)))
)
INHERITS (_timescaledb_internal._materialized_hypertable_17);


ALTER TABLE _timescaledb_internal._hyper_17_28_chunk OWNER TO gaveurs_admin;

--
-- Name: _materialized_hypertable_18; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._materialized_hypertable_18 (
    day timestamp with time zone NOT NULL,
    site_code character varying(2),
    sample_count bigint,
    count_a_plus bigint,
    avg_quality_score numeric,
    avg_freshness numeric,
    compliance_rate_pct double precision,
    last_refresh timestamp with time zone
);


ALTER TABLE _timescaledb_internal._materialized_hypertable_18 OWNER TO gaveurs_admin;

--
-- Name: _hyper_18_29_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._hyper_18_29_chunk (
    CONSTRAINT constraint_28 CHECK (((day >= '2025-12-18 00:00:00+00'::timestamp with time zone) AND (day < '2026-02-26 00:00:00+00'::timestamp with time zone)))
)
INHERITS (_timescaledb_internal._materialized_hypertable_18);


ALTER TABLE _timescaledb_internal._hyper_18_29_chunk OWNER TO gaveurs_admin;

--
-- Name: doses_journalieres; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.doses_journalieres (
    "time" timestamp with time zone NOT NULL,
    lot_id integer NOT NULL,
    jour_gavage integer NOT NULL,
    feed_target numeric(6,2),
    feed_real numeric(6,2),
    corn_variation numeric(6,2),
    delta_feed numeric(6,2),
    cumul_corn numeric(8,2),
    created_at timestamp with time zone DEFAULT now(),
    code_lot character varying(20),
    jour integer,
    moment character varying(10),
    dose_theorique numeric(6,2),
    dose_reelle numeric(6,2),
    poids_moyen numeric(8,2),
    nb_vivants integer,
    taux_mortalite numeric(5,2),
    temperature numeric(5,2),
    humidite numeric(5,2)
);


ALTER TABLE public.doses_journalieres OWNER TO gaveurs_admin;

--
-- Name: TABLE doses_journalieres; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.doses_journalieres IS 'Données journalières de gavage (hypertable TimescaleDB)';


--
-- Name: COLUMN doses_journalieres.feed_target; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.doses_journalieres.feed_target IS 'Dose théorique planifiée (grammes)';


--
-- Name: COLUMN doses_journalieres.feed_real; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.doses_journalieres.feed_real IS 'Dose réellement distribuée (grammes)';


--
-- Name: COLUMN doses_journalieres.corn_variation; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.doses_journalieres.corn_variation IS 'Écart entre dose réelle et théorique';


--
-- Name: COLUMN doses_journalieres.delta_feed; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.doses_journalieres.delta_feed IS 'Variation de dose par rapport au jour précédent';


--
-- Name: COLUMN doses_journalieres.code_lot; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.doses_journalieres.code_lot IS 'Code du lot (référence directe pour simulateur)';


--
-- Name: COLUMN doses_journalieres.jour; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.doses_journalieres.jour IS 'Jour du gavage (0 à 14)';


--
-- Name: COLUMN doses_journalieres.moment; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.doses_journalieres.moment IS 'Moment du gavage (matin ou soir)';


--
-- Name: COLUMN doses_journalieres.dose_theorique; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.doses_journalieres.dose_theorique IS 'Dose théorique calculée (grammes)';


--
-- Name: COLUMN doses_journalieres.dose_reelle; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.doses_journalieres.dose_reelle IS 'Dose réellement administrée (grammes)';


--
-- Name: COLUMN doses_journalieres.poids_moyen; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.doses_journalieres.poids_moyen IS 'Poids moyen des canards (grammes)';


--
-- Name: COLUMN doses_journalieres.nb_vivants; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.doses_journalieres.nb_vivants IS 'Nombre de canards vivants';


--
-- Name: COLUMN doses_journalieres.taux_mortalite; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.doses_journalieres.taux_mortalite IS 'Taux de mortalité (%)';


--
-- Name: COLUMN doses_journalieres.temperature; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.doses_journalieres.temperature IS 'Température stabule (°C)';


--
-- Name: COLUMN doses_journalieres.humidite; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.doses_journalieres.humidite IS 'Humidité stabule (%)';


--
-- Name: _hyper_1_24_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._hyper_1_24_chunk (
    CONSTRAINT constraint_23 CHECK ((("time" >= '2026-01-01 00:00:00+00'::timestamp with time zone) AND ("time" < '2026-01-08 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.doses_journalieres);


ALTER TABLE _timescaledb_internal._hyper_1_24_chunk OWNER TO gaveurs_admin;

--
-- Name: _hyper_1_25_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._hyper_1_25_chunk (
    CONSTRAINT constraint_24 CHECK ((("time" >= '2025-12-25 00:00:00+00'::timestamp with time zone) AND ("time" < '2026-01-01 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.doses_journalieres);


ALTER TABLE _timescaledb_internal._hyper_1_25_chunk OWNER TO gaveurs_admin;

--
-- Name: _hyper_22_22_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._hyper_22_22_chunk (
    CONSTRAINT constraint_22 CHECK (((date_gavage >= '2025-12-18'::date) AND (date_gavage < '2025-12-25'::date)))
)
INHERITS (public.gavage_lot_quotidien);


ALTER TABLE _timescaledb_internal._hyper_22_22_chunk OWNER TO gaveurs_admin;

--
-- Name: _hyper_22_26_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._hyper_22_26_chunk (
    CONSTRAINT constraint_25 CHECK (((date_gavage >= '2026-01-01'::date) AND (date_gavage < '2026-01-08'::date)))
)
INHERITS (public.gavage_lot_quotidien);


ALTER TABLE _timescaledb_internal._hyper_22_26_chunk OWNER TO gaveurs_admin;

--
-- Name: _hyper_22_6_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._hyper_22_6_chunk (
    CONSTRAINT constraint_6 CHECK (((date_gavage >= '2024-12-26'::date) AND (date_gavage < '2025-01-02'::date)))
)
INHERITS (public.gavage_lot_quotidien);


ALTER TABLE _timescaledb_internal._hyper_22_6_chunk OWNER TO gaveurs_admin;

--
-- Name: _hyper_22_7_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._hyper_22_7_chunk (
    CONSTRAINT constraint_7 CHECK (((date_gavage >= '2025-12-25'::date) AND (date_gavage < '2026-01-01'::date)))
)
INHERITS (public.gavage_lot_quotidien);


ALTER TABLE _timescaledb_internal._hyper_22_7_chunk OWNER TO gaveurs_admin;

--
-- Name: _materialized_hypertable_23; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._materialized_hypertable_23 (
    lot_id integer,
    jour date NOT NULL,
    poids_moyen numeric,
    dose_moyenne numeric,
    temperature_moyenne numeric,
    humidite_moyenne numeric,
    ecart_moyen numeric,
    mortalite_totale bigint,
    nombre_enregistrements bigint,
    nombre_alertes bigint
);


ALTER TABLE _timescaledb_internal._materialized_hypertable_23 OWNER TO gaveurs_admin;

--
-- Name: _hyper_23_8_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._hyper_23_8_chunk (
    CONSTRAINT constraint_8 CHECK (((jour >= '2025-12-18'::date) AND (jour < '2026-02-26'::date)))
)
INHERITS (_timescaledb_internal._materialized_hypertable_23);


ALTER TABLE _timescaledb_internal._hyper_23_8_chunk OWNER TO gaveurs_admin;

--
-- Name: gavage_data_lots; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.gavage_data_lots (
    "time" timestamp with time zone NOT NULL,
    lot_gavage_id integer NOT NULL,
    jour_gavage integer NOT NULL,
    repas character varying(10) NOT NULL,
    dose_moyenne numeric(6,2) NOT NULL,
    dose_theorique numeric(6,2),
    poids_moyen_lot numeric(8,2),
    nb_canards_vivants integer,
    nb_canards_morts integer DEFAULT 0,
    taux_mortalite numeric(5,2) DEFAULT 0.0,
    temperature_stabule numeric(4,1) NOT NULL,
    humidite_stabule numeric(5,2),
    remarques text
);


ALTER TABLE public.gavage_data_lots OWNER TO gaveurs_admin;

--
-- Name: _hyper_24_219_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._hyper_24_219_chunk (
    CONSTRAINT constraint_218 CHECK ((("time" >= '2026-01-01 00:00:00+00'::timestamp with time zone) AND ("time" < '2026-01-08 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gavage_data_lots);


ALTER TABLE _timescaledb_internal._hyper_24_219_chunk OWNER TO gaveurs_admin;

--
-- Name: _hyper_24_220_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._hyper_24_220_chunk (
    CONSTRAINT constraint_219 CHECK ((("time" >= '2026-01-08 00:00:00+00'::timestamp with time zone) AND ("time" < '2026-01-15 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gavage_data_lots);


ALTER TABLE _timescaledb_internal._hyper_24_220_chunk OWNER TO gaveurs_admin;

--
-- Name: _hyper_5_2_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._hyper_5_2_chunk (
    CONSTRAINT constraint_2 CHECK ((("time" >= '2025-12-18 00:00:00+00'::timestamp with time zone) AND ("time" < '2025-12-25 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gavage_data);


ALTER TABLE _timescaledb_internal._hyper_5_2_chunk OWNER TO gaveurs_admin;

--
-- Name: _hyper_5_3_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._hyper_5_3_chunk (
    CONSTRAINT constraint_3 CHECK ((("time" >= '2025-12-25 00:00:00+00'::timestamp with time zone) AND ("time" < '2026-01-01 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.gavage_data);


ALTER TABLE _timescaledb_internal._hyper_5_3_chunk OWNER TO gaveurs_admin;

--
-- Name: _materialized_hypertable_7; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._materialized_hypertable_7 (
    day timestamp with time zone NOT NULL,
    canard_id integer,
    poids_moyen_matin numeric,
    poids_moyen_soir numeric,
    gain_poids_moyen numeric,
    dose_totale_jour numeric,
    temperature_moyenne numeric,
    humidite_moyenne numeric,
    nb_mesures bigint
);


ALTER TABLE _timescaledb_internal._materialized_hypertable_7 OWNER TO gaveurs_admin;

--
-- Name: _hyper_7_4_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._hyper_7_4_chunk (
    CONSTRAINT constraint_4 CHECK (((day >= '2025-12-18 00:00:00+00'::timestamp with time zone) AND (day < '2026-02-26 00:00:00+00'::timestamp with time zone)))
)
INHERITS (_timescaledb_internal._materialized_hypertable_7);


ALTER TABLE _timescaledb_internal._hyper_7_4_chunk OWNER TO gaveurs_admin;

--
-- Name: alertes; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.alertes (
    "time" timestamp with time zone NOT NULL,
    canard_id integer NOT NULL,
    niveau character varying(20) NOT NULL,
    type_alerte character varying(50) NOT NULL,
    message text NOT NULL,
    valeur_mesuree numeric(10,2),
    valeur_seuil numeric(10,2),
    sms_envoye boolean DEFAULT false,
    acquittee boolean DEFAULT false,
    acquittee_par integer,
    acquittee_le timestamp with time zone,
    CONSTRAINT alertes_niveau_check CHECK (((niveau)::text = ANY ((ARRAY['critique'::character varying, 'important'::character varying, 'info'::character varying])::text[])))
);


ALTER TABLE public.alertes OWNER TO gaveurs_admin;

--
-- Name: TABLE alertes; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.alertes IS 'Alertes individuelles pour les canards - Hypertable TimescaleDB';


--
-- Name: COLUMN alertes.niveau; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.alertes.niveau IS 'Niveau: critique, important, info';


--
-- Name: COLUMN alertes.type_alerte; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.alertes.type_alerte IS 'Type: poids_faible, temperature, mortalite, etc.';


--
-- Name: COLUMN alertes.sms_envoye; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.alertes.sms_envoye IS 'Indique si un SMS a été envoyé pour cette alerte';


--
-- Name: _hyper_9_1_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._hyper_9_1_chunk (
    CONSTRAINT constraint_1 CHECK ((("time" >= '2025-12-25 00:00:00+00'::timestamp with time zone) AND ("time" < '2026-01-01 00:00:00+00'::timestamp with time zone)))
)
INHERITS (public.alertes);


ALTER TABLE _timescaledb_internal._hyper_9_1_chunk OWNER TO gaveurs_admin;

--
-- Name: _materialized_hypertable_14; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._materialized_hypertable_14 (
    bucket timestamp with time zone NOT NULL,
    lot_id integer,
    site_code character varying(2),
    daily_feedbacks bigint,
    avg_overall_rating numeric,
    avg_texture_rating numeric,
    avg_flavor_rating numeric,
    avg_freshness_rating numeric,
    recommendation_rate_pct double precision,
    satisfaction_rate_pct double precision
);


ALTER TABLE _timescaledb_internal._materialized_hypertable_14 OWNER TO gaveurs_admin;

--
-- Name: _materialized_hypertable_15; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._materialized_hypertable_15 (
    bucket timestamp with time zone NOT NULL,
    site_code character varying(2),
    weekly_feedbacks bigint,
    avg_overall_rating numeric,
    avg_texture_rating numeric,
    avg_flavor_rating numeric,
    avg_color_rating numeric,
    avg_aroma_rating numeric,
    avg_freshness_rating numeric,
    recommendation_rate_pct double precision,
    satisfaction_rate_pct double precision,
    nps_score double precision
);


ALTER TABLE _timescaledb_internal._materialized_hypertable_15 OWNER TO gaveurs_admin;

--
-- Name: _materialized_hypertable_8; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal._materialized_hypertable_8 (
    week timestamp with time zone NOT NULL,
    genetique character varying(20),
    nombre_canards bigint,
    gain_poids_moyen numeric,
    dose_moyenne_totale numeric,
    temperature_moyenne numeric
);


ALTER TABLE _timescaledb_internal._materialized_hypertable_8 OWNER TO gaveurs_admin;

--
-- Name: _partial_view_14; Type: VIEW; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE VIEW _timescaledb_internal._partial_view_14 AS
 SELECT public.time_bucket('1 day'::interval, f."time") AS bucket,
    p.lot_id,
    p.site_code,
    count(f.feedback_id) AS daily_feedbacks,
    avg(f.overall_rating) AS avg_overall_rating,
    avg(f.texture_rating) AS avg_texture_rating,
    avg(f.flavor_rating) AS avg_flavor_rating,
    avg(f.freshness_rating) AS avg_freshness_rating,
    (((count(*) FILTER (WHERE (f.would_recommend = true)))::double precision / (NULLIF(count(*), 0))::double precision) * (100)::double precision) AS recommendation_rate_pct,
    (((count(*) FILTER (WHERE (f.overall_rating >= 4)))::double precision / (NULLIF(count(*), 0))::double precision) * (100)::double precision) AS satisfaction_rate_pct
   FROM (public.consumer_feedbacks f
     JOIN public.consumer_products p ON (((f.product_id)::text = (p.product_id)::text)))
  WHERE (f.is_public = true)
  GROUP BY (public.time_bucket('1 day'::interval, f."time")), p.lot_id, p.site_code;


ALTER TABLE _timescaledb_internal._partial_view_14 OWNER TO gaveurs_admin;

--
-- Name: _partial_view_15; Type: VIEW; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE VIEW _timescaledb_internal._partial_view_15 AS
 SELECT public.time_bucket('7 days'::interval, f."time") AS bucket,
    p.site_code,
    count(f.feedback_id) AS weekly_feedbacks,
    avg(f.overall_rating) AS avg_overall_rating,
    avg(f.texture_rating) AS avg_texture_rating,
    avg(f.flavor_rating) AS avg_flavor_rating,
    avg(f.color_rating) AS avg_color_rating,
    avg(f.aroma_rating) AS avg_aroma_rating,
    avg(f.freshness_rating) AS avg_freshness_rating,
    (((count(*) FILTER (WHERE (f.would_recommend = true)))::double precision / (NULLIF(count(*), 0))::double precision) * (100)::double precision) AS recommendation_rate_pct,
    (((count(*) FILTER (WHERE (f.overall_rating >= 4)))::double precision / (NULLIF(count(*), 0))::double precision) * (100)::double precision) AS satisfaction_rate_pct,
    ((((count(*) FILTER (WHERE (f.overall_rating = 5)))::double precision / (NULLIF(count(*), 0))::double precision) * (100)::double precision) - (((count(*) FILTER (WHERE (f.overall_rating <= 2)))::double precision / (NULLIF(count(*), 0))::double precision) * (100)::double precision)) AS nps_score
   FROM (public.consumer_feedbacks f
     JOIN public.consumer_products p ON (((f.product_id)::text = (p.product_id)::text)))
  WHERE (f.is_public = true)
  GROUP BY (public.time_bucket('7 days'::interval, f."time")), p.site_code;


ALTER TABLE _timescaledb_internal._partial_view_15 OWNER TO gaveurs_admin;

--
-- Name: _partial_view_17; Type: VIEW; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE VIEW _timescaledb_internal._partial_view_17 AS
 SELECT public.time_bucket('01:00:00'::interval, sqal_sensor_samples."time") AS bucket,
    sqal_sensor_samples.device_id,
    count(*) AS sample_count,
    count(*) FILTER (WHERE ((sqal_sensor_samples.fusion_final_grade)::text = 'A+'::text)) AS count_a_plus,
    count(*) FILTER (WHERE ((sqal_sensor_samples.fusion_final_grade)::text = 'A'::text)) AS count_a,
    count(*) FILTER (WHERE ((sqal_sensor_samples.fusion_final_grade)::text = 'B'::text)) AS count_b,
    count(*) FILTER (WHERE ((sqal_sensor_samples.fusion_final_grade)::text = 'C'::text)) AS count_c,
    count(*) FILTER (WHERE ((sqal_sensor_samples.fusion_final_grade)::text = 'REJECT'::text)) AS count_reject,
    avg(sqal_sensor_samples.fusion_final_score) AS avg_quality_score,
    min(sqal_sensor_samples.fusion_final_score) AS min_quality_score,
    max(sqal_sensor_samples.fusion_final_score) AS max_quality_score,
    avg(sqal_sensor_samples.as7341_freshness_index) AS avg_freshness,
    avg(sqal_sensor_samples.as7341_fat_quality_index) AS avg_fat_quality,
    avg(sqal_sensor_samples.as7341_oxidation_index) AS avg_oxidation,
    avg(sqal_sensor_samples.vl53l8ch_volume_mm3) AS avg_volume,
    avg(sqal_sensor_samples.vl53l8ch_surface_uniformity) AS avg_uniformity,
    count(*) FILTER (WHERE (sqal_sensor_samples.fusion_is_compliant = true)) AS count_compliant,
    now() AS last_refresh
   FROM public.sqal_sensor_samples
  GROUP BY (public.time_bucket('01:00:00'::interval, sqal_sensor_samples."time")), sqal_sensor_samples.device_id;


ALTER TABLE _timescaledb_internal._partial_view_17 OWNER TO gaveurs_admin;

--
-- Name: _partial_view_18; Type: VIEW; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE VIEW _timescaledb_internal._partial_view_18 AS
 SELECT public.time_bucket('1 day'::interval, s."time") AS day,
    d.site_code,
    count(*) AS sample_count,
    count(*) FILTER (WHERE ((s.fusion_final_grade)::text = 'A+'::text)) AS count_a_plus,
    avg(s.fusion_final_score) AS avg_quality_score,
    avg(s.as7341_freshness_index) AS avg_freshness,
    (((count(*) FILTER (WHERE (s.fusion_is_compliant = true)))::double precision / (count(*))::double precision) * (100)::double precision) AS compliance_rate_pct,
    now() AS last_refresh
   FROM (public.sqal_sensor_samples s
     JOIN public.sqal_devices d ON (((s.device_id)::text = (d.device_id)::text)))
  WHERE (d.site_code IS NOT NULL)
  GROUP BY (public.time_bucket('1 day'::interval, s."time")), d.site_code;


ALTER TABLE _timescaledb_internal._partial_view_18 OWNER TO gaveurs_admin;

--
-- Name: _partial_view_23; Type: VIEW; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE VIEW _timescaledb_internal._partial_view_23 AS
 SELECT gavage_lot_quotidien.lot_id,
    public.time_bucket('1 day'::interval, gavage_lot_quotidien.date_gavage) AS jour,
    avg(gavage_lot_quotidien.poids_moyen_mesure) AS poids_moyen,
    avg(gavage_lot_quotidien.dose_totale_jour) AS dose_moyenne,
    avg(gavage_lot_quotidien.temperature_stabule) AS temperature_moyenne,
    avg(gavage_lot_quotidien.humidite_stabule) AS humidite_moyenne,
    avg(gavage_lot_quotidien.ecart_poids_pourcent) AS ecart_moyen,
    sum(gavage_lot_quotidien.mortalite_jour) AS mortalite_totale,
    count(*) AS nombre_enregistrements,
    sum(
        CASE
            WHEN gavage_lot_quotidien.alerte_generee THEN 1
            ELSE 0
        END) AS nombre_alertes
   FROM public.gavage_lot_quotidien
  GROUP BY gavage_lot_quotidien.lot_id, (public.time_bucket('1 day'::interval, gavage_lot_quotidien.date_gavage));


ALTER TABLE _timescaledb_internal._partial_view_23 OWNER TO gaveurs_admin;

--
-- Name: _partial_view_7; Type: VIEW; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE VIEW _timescaledb_internal._partial_view_7 AS
 SELECT public.time_bucket('1 day'::interval, gavage_data."time") AS day,
    gavage_data.canard_id,
    avg(gavage_data.poids_matin) AS poids_moyen_matin,
    avg(gavage_data.poids_soir) AS poids_moyen_soir,
    avg((gavage_data.poids_soir - gavage_data.poids_matin)) AS gain_poids_moyen,
    sum((gavage_data.dose_matin + gavage_data.dose_soir)) AS dose_totale_jour,
    avg(gavage_data.temperature_stabule) AS temperature_moyenne,
    avg(gavage_data.humidite_stabule) AS humidite_moyenne,
    count(*) AS nb_mesures
   FROM public.gavage_data
  GROUP BY (public.time_bucket('1 day'::interval, gavage_data."time")), gavage_data.canard_id;


ALTER TABLE _timescaledb_internal._partial_view_7 OWNER TO gaveurs_admin;

--
-- Name: _partial_view_8; Type: VIEW; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE VIEW _timescaledb_internal._partial_view_8 AS
 SELECT public.time_bucket('7 days'::interval, gd."time") AS week,
    c.genetique,
    count(DISTINCT gd.canard_id) AS nombre_canards,
    avg((gd.poids_soir - gd.poids_matin)) AS gain_poids_moyen,
    avg((gd.dose_matin + gd.dose_soir)) AS dose_moyenne_totale,
    avg(gd.temperature_stabule) AS temperature_moyenne
   FROM (public.gavage_data gd
     JOIN public.canards c ON ((gd.canard_id = c.id)))
  GROUP BY (public.time_bucket('7 days'::interval, gd."time")), c.genetique;


ALTER TABLE _timescaledb_internal._partial_view_8 OWNER TO gaveurs_admin;

--
-- Name: compress_hyper_6_23_chunk; Type: TABLE; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TABLE _timescaledb_internal.compress_hyper_6_23_chunk (
    _ts_meta_count integer,
    canard_id integer,
    _ts_meta_min_1 timestamp with time zone,
    _ts_meta_max_1 timestamp with time zone,
    "time" _timescaledb_internal.compressed_data,
    dose_matin _timescaledb_internal.compressed_data,
    dose_soir _timescaledb_internal.compressed_data,
    dose_theorique_matin _timescaledb_internal.compressed_data,
    dose_theorique_soir _timescaledb_internal.compressed_data,
    heure_gavage_matin _timescaledb_internal.compressed_data,
    heure_gavage_soir _timescaledb_internal.compressed_data,
    poids_matin _timescaledb_internal.compressed_data,
    poids_soir _timescaledb_internal.compressed_data,
    temperature_stabule _timescaledb_internal.compressed_data,
    humidite_stabule _timescaledb_internal.compressed_data,
    qualite_air_co2 _timescaledb_internal.compressed_data,
    luminosite _timescaledb_internal.compressed_data,
    lot_mais_id _timescaledb_internal.compressed_data,
    remarques _timescaledb_internal.compressed_data,
    comportement_observe _timescaledb_internal.compressed_data,
    etat_sanitaire _timescaledb_internal.compressed_data,
    correction_proposee _timescaledb_internal.compressed_data,
    ecart_dose_matin _timescaledb_internal.compressed_data,
    ecart_dose_soir _timescaledb_internal.compressed_data,
    _ts_meta_v2_min_alerte_generee boolean,
    _ts_meta_v2_max_alerte_generee boolean,
    alerte_generee _timescaledb_internal.compressed_data,
    poids_actuel _timescaledb_internal.compressed_data
)
WITH (toast_tuple_target='128');
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN _ts_meta_count SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN canard_id SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN _ts_meta_min_1 SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN _ts_meta_max_1 SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN "time" SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN dose_matin SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN dose_matin SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN dose_soir SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN dose_soir SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN dose_theorique_matin SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN dose_theorique_matin SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN dose_theorique_soir SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN dose_theorique_soir SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN heure_gavage_matin SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN heure_gavage_matin SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN heure_gavage_soir SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN heure_gavage_soir SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN poids_matin SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN poids_matin SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN poids_soir SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN poids_soir SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN temperature_stabule SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN temperature_stabule SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN humidite_stabule SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN humidite_stabule SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN qualite_air_co2 SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN qualite_air_co2 SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN luminosite SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN luminosite SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN lot_mais_id SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN remarques SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN remarques SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN comportement_observe SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN comportement_observe SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN etat_sanitaire SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN etat_sanitaire SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN correction_proposee SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN correction_proposee SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN ecart_dose_matin SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN ecart_dose_matin SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN ecart_dose_soir SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN ecart_dose_soir SET STORAGE EXTENDED;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN _ts_meta_v2_min_alerte_generee SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN _ts_meta_v2_max_alerte_generee SET STATISTICS 1000;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN alerte_generee SET STATISTICS 0;
ALTER TABLE ONLY _timescaledb_internal.compress_hyper_6_23_chunk ALTER COLUMN poids_actuel SET STORAGE EXTENDED;


ALTER TABLE _timescaledb_internal.compress_hyper_6_23_chunk OWNER TO gaveurs_admin;

--
-- Name: abattoirs; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.abattoirs (
    id integer NOT NULL,
    nom character varying(200) NOT NULL,
    adresse text NOT NULL,
    ville character varying(100) NOT NULL,
    code_postal character varying(10) NOT NULL,
    numero_agrement character varying(50) NOT NULL,
    contact_telephone character varying(15) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.abattoirs OWNER TO gaveurs_admin;

--
-- Name: abattoirs_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.abattoirs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.abattoirs_id_seq OWNER TO gaveurs_admin;

--
-- Name: abattoirs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.abattoirs_id_seq OWNED BY public.abattoirs.id;


--
-- Name: alertes_euralis; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.alertes_euralis (
    "time" timestamp with time zone NOT NULL,
    id integer NOT NULL,
    lot_id integer,
    gaveur_id integer,
    site_code character varying(2),
    type_alerte character varying(50) NOT NULL,
    criticite character varying(20) NOT NULL,
    titre character varying(200) NOT NULL,
    description text,
    valeur_observee numeric(10,4),
    valeur_attendue numeric(10,4),
    ecart_pct numeric(6,2),
    acquittee boolean DEFAULT false,
    acquittee_par character varying(100),
    acquittee_le timestamp with time zone,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.alertes_euralis OWNER TO gaveurs_admin;

--
-- Name: TABLE alertes_euralis; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.alertes_euralis IS 'Alertes multi-niveaux (lot/gaveur/site) - Hypertable TimescaleDB';


--
-- Name: alertes_euralis_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.alertes_euralis_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.alertes_euralis_id_seq OWNER TO gaveurs_admin;

--
-- Name: alertes_euralis_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.alertes_euralis_id_seq OWNED BY public.alertes_euralis.id;


--
-- Name: anomalies_detectees; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.anomalies_detectees (
    id integer NOT NULL,
    niveau character varying(20) NOT NULL,
    lot_id integer,
    gaveur_id integer,
    site_code character varying(2),
    score_anomalie numeric(10,8),
    is_anomaly boolean DEFAULT false,
    raisons text[],
    metriques_anormales jsonb,
    modele_version character varying(50),
    detectee_le timestamp with time zone DEFAULT now(),
    traitee boolean DEFAULT false,
    traitee_le timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.anomalies_detectees OWNER TO gaveurs_admin;

--
-- Name: TABLE anomalies_detectees; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.anomalies_detectees IS 'Anomalies détectées par Isolation Forest';


--
-- Name: anomalies_detectees_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.anomalies_detectees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.anomalies_detectees_id_seq OWNER TO gaveurs_admin;

--
-- Name: anomalies_detectees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.anomalies_detectees_id_seq OWNED BY public.anomalies_detectees.id;


--
-- Name: blockchain; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.blockchain (
    index integer NOT NULL,
    "timestamp" timestamp with time zone NOT NULL,
    type_evenement character varying(50) NOT NULL,
    canard_id integer NOT NULL,
    gaveur_id integer NOT NULL,
    abattoir_id integer,
    donnees jsonb NOT NULL,
    hash_precedent character varying(64) NOT NULL,
    hash_actuel character varying(64) NOT NULL,
    signature_numerique text NOT NULL,
    CONSTRAINT blockchain_type_evenement_check CHECK (((type_evenement)::text = ANY ((ARRAY['genesis'::character varying, 'initialisation_canard'::character varying, 'gavage'::character varying, 'pesee'::character varying, 'abattage'::character varying, 'transport'::character varying])::text[])))
);


ALTER TABLE public.blockchain OWNER TO gaveurs_admin;

--
-- Name: TABLE blockchain; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.blockchain IS 'Blockchain pour traçabilité complète de la naissance à l abattoir';


--
-- Name: bug_comments; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.bug_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bug_report_id uuid NOT NULL,
    comment text NOT NULL,
    author character varying(200) NOT NULL,
    author_email character varying(200),
    is_internal boolean DEFAULT false,
    attachments jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone
);


ALTER TABLE public.bug_comments OWNER TO gaveurs_admin;

--
-- Name: bug_metrics; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.bug_metrics (
    id integer NOT NULL,
    date date NOT NULL,
    total_bugs integer DEFAULT 0,
    open_bugs integer DEFAULT 0,
    in_progress_bugs integer DEFAULT 0,
    resolved_bugs integer DEFAULT 0,
    closed_bugs integer DEFAULT 0,
    critical_bugs integer DEFAULT 0,
    high_severity_bugs integer DEFAULT 0,
    medium_severity_bugs integer DEFAULT 0,
    low_severity_bugs integer DEFAULT 0,
    avg_resolution_time_hours numeric(10,2),
    avg_response_time_hours numeric(10,2),
    new_bugs_today integer DEFAULT 0,
    resolved_today integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bug_metrics OWNER TO gaveurs_admin;

--
-- Name: bug_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.bug_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.bug_metrics_id_seq OWNER TO gaveurs_admin;

--
-- Name: bug_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.bug_metrics_id_seq OWNED BY public.bug_metrics.id;


--
-- Name: bug_reports; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.bug_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(300) NOT NULL,
    description text NOT NULL,
    severity character varying(50) NOT NULL,
    priority character varying(50) NOT NULL,
    category character varying(100),
    status character varying(50) DEFAULT 'open'::character varying NOT NULL,
    device_id character varying(100),
    firmware_version character varying(50),
    sample_id character varying(100),
    reported_by character varying(200),
    reported_by_email character varying(200),
    assigned_to character varying(200),
    assigned_at timestamp with time zone,
    resolution text,
    resolved_at timestamp with time zone,
    resolved_by character varying(200),
    attachments jsonb,
    error_logs jsonb,
    reproduction_steps text,
    tags jsonb,
    related_issues jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    CONSTRAINT bug_reports_priority_check CHECK (((priority)::text = ANY ((ARRAY['urgent'::character varying, 'high'::character varying, 'medium'::character varying, 'low'::character varying])::text[]))),
    CONSTRAINT bug_reports_severity_check CHECK (((severity)::text = ANY ((ARRAY['critical'::character varying, 'high'::character varying, 'medium'::character varying, 'low'::character varying])::text[]))),
    CONSTRAINT bug_reports_status_check CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'in_progress'::character varying, 'resolved'::character varying, 'closed'::character varying, 'wont_fix'::character varying])::text[])))
);


ALTER TABLE public.bug_reports OWNER TO gaveurs_admin;

--
-- Name: gaveurs; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.gaveurs (
    id integer NOT NULL,
    nom character varying(100) NOT NULL,
    prenom character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    telephone character varying(15) NOT NULL,
    password_hash character varying(255) NOT NULL,
    adresse text,
    certifications text[],
    actif boolean DEFAULT true,
    cle_publique_blockchain text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.gaveurs OWNER TO gaveurs_admin;

--
-- Name: canards_actifs_stats; Type: VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE VIEW public.canards_actifs_stats AS
 SELECT c.id,
    c.numero_identification,
    c.genetique,
    c.gaveur_id,
    (((g.nom)::text || ' '::text) || (g.prenom)::text) AS gaveur_nom,
    c.poids_initial,
    (EXTRACT(epoch FROM (now() - c.created_at)) / (86400)::numeric) AS jours_gavage,
    COALESCE(last_data.poids_soir, c.poids_initial) AS poids_actuel,
    (COALESCE(last_data.poids_soir, c.poids_initial) - c.poids_initial) AS gain_total,
    COALESCE(stats.dose_totale, (0)::numeric) AS dose_totale_consommee,
    COALESCE(alertes_count.nb_alertes, (0)::bigint) AS nombre_alertes
   FROM ((((public.canards c
     JOIN public.gaveurs g ON ((c.gaveur_id = g.id)))
     LEFT JOIN LATERAL ( SELECT gavage_data.poids_soir
           FROM public.gavage_data
          WHERE (gavage_data.canard_id = c.id)
          ORDER BY gavage_data."time" DESC
         LIMIT 1) last_data ON (true))
     LEFT JOIN LATERAL ( SELECT sum((gavage_data.dose_matin + gavage_data.dose_soir)) AS dose_totale
           FROM public.gavage_data
          WHERE (gavage_data.canard_id = c.id)) stats ON (true))
     LEFT JOIN LATERAL ( SELECT count(*) AS nb_alertes
           FROM public.alertes
          WHERE ((alertes.canard_id = c.id) AND (alertes.acquittee = false))) alertes_count ON (true))
  WHERE ((c.statut)::text = 'en_gavage'::text);


ALTER TABLE public.canards_actifs_stats OWNER TO gaveurs_admin;

--
-- Name: canards_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.canards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.canards_id_seq OWNER TO gaveurs_admin;

--
-- Name: canards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.canards_id_seq OWNED BY public.canards.id;


--
-- Name: canards_lots; Type: VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE VIEW public.canards_lots AS
 SELECT canards.id AS canard_id,
    canards.lot_id
   FROM public.canards
  WHERE (canards.lot_id IS NOT NULL);


ALTER TABLE public.canards_lots OWNER TO gaveurs_admin;

--
-- Name: consumer_feedback_ml_data; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.consumer_feedback_ml_data (
    ml_data_id integer NOT NULL,
    feedback_id integer NOT NULL,
    lot_id integer NOT NULL,
    sample_id character varying(100),
    lot_itm numeric(6,2),
    lot_avg_weight numeric(8,2),
    lot_mortality_rate numeric(5,2),
    lot_feed_conversion numeric(6,3),
    sqal_score numeric(5,4),
    sqal_grade character varying(10),
    vl53l8ch_volume_mm3 numeric(10,2),
    vl53l8ch_surface_uniformity numeric(5,4),
    as7341_freshness_index numeric(5,4),
    as7341_fat_quality_index numeric(5,4),
    as7341_oxidation_index numeric(5,4),
    consumer_overall_rating smallint,
    consumer_texture_rating smallint,
    consumer_flavor_rating smallint,
    consumer_freshness_rating smallint,
    consumer_would_recommend boolean,
    site_code character varying(2),
    production_date date,
    consumption_delay_days integer,
    created_at timestamp with time zone DEFAULT now(),
    used_for_training boolean DEFAULT false,
    train_test_split character varying(10)
);


ALTER TABLE public.consumer_feedback_ml_data OWNER TO gaveurs_admin;

--
-- Name: TABLE consumer_feedback_ml_data; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.consumer_feedback_ml_data IS 'Données préparées pour entraînement IA (corrélation prod ↔ feedback)';


--
-- Name: consumer_feedback_ml_data_ml_data_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.consumer_feedback_ml_data_ml_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.consumer_feedback_ml_data_ml_data_id_seq OWNER TO gaveurs_admin;

--
-- Name: consumer_feedback_ml_data_ml_data_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.consumer_feedback_ml_data_ml_data_id_seq OWNED BY public.consumer_feedback_ml_data.ml_data_id;


--
-- Name: consumer_feedback_ml_insights; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.consumer_feedback_ml_insights (
    insight_id integer NOT NULL,
    model_name character varying(100) NOT NULL,
    model_version character varying(20) NOT NULL,
    generated_at timestamp with time zone DEFAULT now(),
    period_start date,
    period_end date,
    site_code character varying(2),
    correlations jsonb NOT NULL,
    feature_importance jsonb NOT NULL,
    recommendations jsonb DEFAULT '[]'::jsonb,
    predicted_consumer_score_avg numeric(4,2),
    prediction_accuracy numeric(5,4),
    sample_size integer,
    training_metrics jsonb,
    is_active boolean DEFAULT true
);


ALTER TABLE public.consumer_feedback_ml_insights OWNER TO gaveurs_admin;

--
-- Name: TABLE consumer_feedback_ml_insights; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.consumer_feedback_ml_insights IS 'Insights IA générés depuis corrélations production ↔ feedback';


--
-- Name: consumer_feedback_ml_insights_insight_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.consumer_feedback_ml_insights_insight_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.consumer_feedback_ml_insights_insight_id_seq OWNER TO gaveurs_admin;

--
-- Name: consumer_feedback_ml_insights_insight_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.consumer_feedback_ml_insights_insight_id_seq OWNED BY public.consumer_feedback_ml_insights.insight_id;


--
-- Name: consumer_feedbacks_feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.consumer_feedbacks_feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.consumer_feedbacks_feedback_id_seq OWNER TO gaveurs_admin;

--
-- Name: consumer_feedbacks_feedback_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.consumer_feedbacks_feedback_id_seq OWNED BY public.consumer_feedbacks.feedback_id;


--
-- Name: consumer_lot_stats; Type: VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE VIEW public.consumer_lot_stats AS
 SELECT _materialized_hypertable_14.bucket,
    _materialized_hypertable_14.lot_id,
    _materialized_hypertable_14.site_code,
    _materialized_hypertable_14.daily_feedbacks,
    _materialized_hypertable_14.avg_overall_rating,
    _materialized_hypertable_14.avg_texture_rating,
    _materialized_hypertable_14.avg_flavor_rating,
    _materialized_hypertable_14.avg_freshness_rating,
    _materialized_hypertable_14.recommendation_rate_pct,
    _materialized_hypertable_14.satisfaction_rate_pct
   FROM _timescaledb_internal._materialized_hypertable_14;


ALTER TABLE public.consumer_lot_stats OWNER TO gaveurs_admin;

--
-- Name: consumer_product_stats; Type: MATERIALIZED VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE MATERIALIZED VIEW public.consumer_product_stats AS
 SELECT p.product_id,
    p.lot_id,
    p.site_code,
    p.production_date,
    p.sqal_quality_score,
    p.sqal_grade,
    count(f.feedback_id) AS total_feedbacks,
    avg(f.overall_rating) AS avg_overall_rating,
    avg(f.texture_rating) AS avg_texture_rating,
    avg(f.flavor_rating) AS avg_flavor_rating,
    avg(f.color_rating) AS avg_color_rating,
    avg(f.aroma_rating) AS avg_aroma_rating,
    avg(f.freshness_rating) AS avg_freshness_rating,
    count(*) FILTER (WHERE (f.overall_rating = 5)) AS count_5_stars,
    count(*) FILTER (WHERE (f.overall_rating = 4)) AS count_4_stars,
    count(*) FILTER (WHERE (f.overall_rating = 3)) AS count_3_stars,
    count(*) FILTER (WHERE (f.overall_rating = 2)) AS count_2_stars,
    count(*) FILTER (WHERE (f.overall_rating = 1)) AS count_1_star,
    (((count(*) FILTER (WHERE (f.would_recommend = true)))::double precision / (NULLIF(count(*), 0))::double precision) * (100)::double precision) AS recommendation_rate_pct,
    avg(f.repurchase_intent) AS avg_repurchase_intent,
    max(f."time") AS last_feedback_date
   FROM (public.consumer_products p
     LEFT JOIN public.consumer_feedbacks f ON ((((p.product_id)::text = (f.product_id)::text) AND (f.is_public = true))))
  GROUP BY p.product_id, p.lot_id, p.site_code, p.production_date, p.sqal_quality_score, p.sqal_grade
  WITH NO DATA;


ALTER TABLE public.consumer_product_stats OWNER TO gaveurs_admin;

--
-- Name: MATERIALIZED VIEW consumer_product_stats; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON MATERIALIZED VIEW public.consumer_product_stats IS 'Stats agrégées feedbacks par produit (refresh quotidien)';


--
-- Name: consumer_products_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.consumer_products_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.consumer_products_seq OWNER TO gaveurs_admin;

--
-- Name: consumer_site_stats; Type: VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE VIEW public.consumer_site_stats AS
 SELECT _materialized_hypertable_15.bucket,
    _materialized_hypertable_15.site_code,
    _materialized_hypertable_15.weekly_feedbacks,
    _materialized_hypertable_15.avg_overall_rating,
    _materialized_hypertable_15.avg_texture_rating,
    _materialized_hypertable_15.avg_flavor_rating,
    _materialized_hypertable_15.avg_color_rating,
    _materialized_hypertable_15.avg_aroma_rating,
    _materialized_hypertable_15.avg_freshness_rating,
    _materialized_hypertable_15.recommendation_rate_pct,
    _materialized_hypertable_15.satisfaction_rate_pct,
    _materialized_hypertable_15.nps_score
   FROM _timescaledb_internal._materialized_hypertable_15;


ALTER TABLE public.consumer_site_stats OWNER TO gaveurs_admin;

--
-- Name: corrections_doses; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.corrections_doses (
    id integer NOT NULL,
    canard_id integer NOT NULL,
    date timestamp with time zone NOT NULL,
    dose_theorique numeric(6,2) NOT NULL,
    dose_reelle numeric(6,2) NOT NULL,
    ecart_absolu numeric(6,2) NOT NULL,
    ecart_pourcentage numeric(5,2) NOT NULL,
    correction_proposee text NOT NULL,
    raison text NOT NULL,
    impact_prevu text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.corrections_doses OWNER TO gaveurs_admin;

--
-- Name: TABLE corrections_doses; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.corrections_doses IS 'Historique des corrections proposées par l IA';


--
-- Name: corrections_doses_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.corrections_doses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.corrections_doses_id_seq OWNER TO gaveurs_admin;

--
-- Name: corrections_doses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.corrections_doses_id_seq OWNED BY public.corrections_doses.id;


--
-- Name: evolution_quotidienne_lots; Type: VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE VIEW public.evolution_quotidienne_lots AS
 SELECT _materialized_hypertable_23.lot_id,
    _materialized_hypertable_23.jour,
    _materialized_hypertable_23.poids_moyen,
    _materialized_hypertable_23.dose_moyenne,
    _materialized_hypertable_23.temperature_moyenne,
    _materialized_hypertable_23.humidite_moyenne,
    _materialized_hypertable_23.ecart_moyen,
    _materialized_hypertable_23.mortalite_totale,
    _materialized_hypertable_23.nombre_enregistrements,
    _materialized_hypertable_23.nombre_alertes
   FROM _timescaledb_internal._materialized_hypertable_23;


ALTER TABLE public.evolution_quotidienne_lots OWNER TO gaveurs_admin;

--
-- Name: formules_pysr; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.formules_pysr (
    id integer NOT NULL,
    site_code character varying(2),
    souche character varying(100),
    formule_sympy text NOT NULL,
    formule_latex text,
    score_r2 numeric(10,8),
    mae numeric(10,6),
    rmse numeric(10,6),
    variables_input text[],
    nb_iterations integer,
    modele_version character varying(50),
    nb_lots_entrainement integer,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.formules_pysr OWNER TO gaveurs_admin;

--
-- Name: TABLE formules_pysr; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.formules_pysr IS 'Formules mathématiques optimales découvertes par PySR';


--
-- Name: formules_pysr_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.formules_pysr_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.formules_pysr_id_seq OWNER TO gaveurs_admin;

--
-- Name: formules_pysr_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.formules_pysr_id_seq OWNED BY public.formules_pysr.id;


--
-- Name: gavage_daily_stats; Type: VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE VIEW public.gavage_daily_stats AS
 SELECT _materialized_hypertable_7.day,
    _materialized_hypertable_7.canard_id,
    _materialized_hypertable_7.poids_moyen_matin,
    _materialized_hypertable_7.poids_moyen_soir,
    _materialized_hypertable_7.gain_poids_moyen,
    _materialized_hypertable_7.dose_totale_jour,
    _materialized_hypertable_7.temperature_moyenne,
    _materialized_hypertable_7.humidite_moyenne,
    _materialized_hypertable_7.nb_mesures
   FROM _timescaledb_internal._materialized_hypertable_7;


ALTER TABLE public.gavage_daily_stats OWNER TO gaveurs_admin;

--
-- Name: gavage_data_insert; Type: VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE VIEW public.gavage_data_insert AS
 SELECT gavage_data."time",
    gavage_data.canard_id,
    gavage_data.dose_matin,
    gavage_data.dose_soir,
    gavage_data.dose_theorique_matin,
    gavage_data.dose_theorique_soir,
    gavage_data.heure_gavage_matin,
    gavage_data.heure_gavage_soir,
    gavage_data.poids_matin,
    gavage_data.poids_soir,
    gavage_data.temperature_stabule,
    gavage_data.humidite_stabule,
    gavage_data.qualite_air_co2,
    gavage_data.luminosite,
    gavage_data.lot_mais_id,
    gavage_data.remarques,
    gavage_data.comportement_observe,
    gavage_data.etat_sanitaire,
    gavage_data.correction_proposee,
    gavage_data.ecart_dose_matin,
    gavage_data.ecart_dose_soir,
    gavage_data.alerte_generee,
    gavage_data.poids_actuel
   FROM public.gavage_data
 LIMIT 0;


ALTER TABLE public.gavage_data_insert OWNER TO gaveurs_admin;

--
-- Name: gavage_lot_quotidien_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.gavage_lot_quotidien_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.gavage_lot_quotidien_id_seq OWNER TO gaveurs_admin;

--
-- Name: gavage_lot_quotidien_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.gavage_lot_quotidien_id_seq OWNED BY public.gavage_lot_quotidien.id;


--
-- Name: gavage_weekly_genetics; Type: VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE VIEW public.gavage_weekly_genetics AS
 SELECT _materialized_hypertable_8.week,
    _materialized_hypertable_8.genetique,
    _materialized_hypertable_8.nombre_canards,
    _materialized_hypertable_8.gain_poids_moyen,
    _materialized_hypertable_8.dose_moyenne_totale,
    _materialized_hypertable_8.temperature_moyenne
   FROM _timescaledb_internal._materialized_hypertable_8;


ALTER TABLE public.gavage_weekly_genetics OWNER TO gaveurs_admin;

--
-- Name: gaveurs_clusters; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.gaveurs_clusters (
    id integer NOT NULL,
    gaveur_id integer,
    cluster_id integer NOT NULL,
    cluster_label character varying(50),
    itm_moyen numeric(6,2),
    sigma_moyen numeric(6,4),
    mortalite_moyenne numeric(6,4),
    nb_lots_total integer,
    stabilite_score numeric(5,4),
    recommandations text[],
    modele_version character varying(50),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.gaveurs_clusters OWNER TO gaveurs_admin;

--
-- Name: TABLE gaveurs_clusters; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.gaveurs_clusters IS 'Segmentation K-Means des gaveurs en 5 groupes';


--
-- Name: gaveurs_clusters_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.gaveurs_clusters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.gaveurs_clusters_id_seq OWNER TO gaveurs_admin;

--
-- Name: gaveurs_clusters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.gaveurs_clusters_id_seq OWNED BY public.gaveurs_clusters.id;


--
-- Name: gaveurs_euralis; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.gaveurs_euralis (
    id integer NOT NULL,
    nom character varying(100) NOT NULL,
    prenom character varying(100),
    nom_usage character varying(100),
    civilite character varying(10),
    raison_sociale character varying(200),
    adresse1 character varying(200),
    adresse2 character varying(200),
    code_postal character varying(10),
    commune character varying(100),
    telephone character varying(20),
    email character varying(100),
    site_code character varying(2),
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.gaveurs_euralis OWNER TO gaveurs_admin;

--
-- Name: TABLE gaveurs_euralis; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.gaveurs_euralis IS 'Gaveurs des 3 sites Euralis';


--
-- Name: gaveurs_euralis_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.gaveurs_euralis_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.gaveurs_euralis_id_seq OWNER TO gaveurs_admin;

--
-- Name: gaveurs_euralis_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.gaveurs_euralis_id_seq OWNED BY public.gaveurs_euralis.id;


--
-- Name: gaveurs_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.gaveurs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.gaveurs_id_seq OWNER TO gaveurs_admin;

--
-- Name: gaveurs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.gaveurs_id_seq OWNED BY public.gaveurs.id;


--
-- Name: lot_events; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.lot_events (
    id integer NOT NULL,
    lot_id character varying(50) NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL,
    event_type character varying(50) NOT NULL,
    data jsonb,
    description text
);


ALTER TABLE public.lot_events OWNER TO gaveurs_admin;

--
-- Name: TABLE lot_events; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.lot_events IS 'Timeline chronologique des événements pour chaque lot';


--
-- Name: lot_events_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.lot_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.lot_events_id_seq OWNER TO gaveurs_admin;

--
-- Name: lot_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.lot_events_id_seq OWNED BY public.lot_events.id;


--
-- Name: lot_mais; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.lot_mais (
    id integer NOT NULL,
    numero_lot character varying(50) NOT NULL,
    origine character varying(200) NOT NULL,
    date_reception timestamp with time zone NOT NULL,
    taux_humidite numeric(5,2),
    qualite_note numeric(3,1),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT lot_mais_qualite_note_check CHECK (((qualite_note >= (0)::numeric) AND (qualite_note <= (10)::numeric))),
    CONSTRAINT lot_mais_taux_humidite_check CHECK (((taux_humidite >= (0)::numeric) AND (taux_humidite <= (100)::numeric)))
);


ALTER TABLE public.lot_mais OWNER TO gaveurs_admin;

--
-- Name: lot_mais_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.lot_mais_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.lot_mais_id_seq OWNER TO gaveurs_admin;

--
-- Name: lot_mais_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.lot_mais_id_seq OWNED BY public.lot_mais.id;


--
-- Name: lots; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.lots (
    id integer NOT NULL,
    code_lot character varying(20) NOT NULL,
    site_origine character varying(50) NOT NULL,
    nombre_canards integer NOT NULL,
    genetique character varying(20) NOT NULL,
    date_debut_gavage date NOT NULL,
    date_fin_gavage_prevue date NOT NULL,
    date_fin_gavage_reelle date,
    poids_moyen_initial numeric(8,2) NOT NULL,
    poids_moyen_actuel numeric(8,2) NOT NULL,
    poids_moyen_final numeric(8,2),
    objectif_quantite_mais integer NOT NULL,
    objectif_poids_final integer NOT NULL,
    courbe_theorique jsonb,
    formule_pysr text,
    r2_score_theorique numeric(5,4),
    statut character varying(20) DEFAULT 'en_preparation'::character varying NOT NULL,
    gaveur_id integer NOT NULL,
    lot_mais_id integer,
    nombre_jours_gavage_ecoules integer DEFAULT 0,
    taux_mortalite numeric(5,2) DEFAULT 0.0,
    nombre_mortalite integer DEFAULT 0,
    taux_conformite numeric(5,2),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT lots_genetique_check CHECK (((genetique)::text = ANY ((ARRAY['mulard'::character varying, 'barbarie'::character varying, 'pekin'::character varying, 'mixte'::character varying])::text[]))),
    CONSTRAINT lots_nombre_canards_check CHECK ((nombre_canards > 0)),
    CONSTRAINT lots_objectif_poids_final_check CHECK ((objectif_poids_final > 0)),
    CONSTRAINT lots_objectif_quantite_mais_check CHECK ((objectif_quantite_mais > 0)),
    CONSTRAINT lots_poids_moyen_actuel_check CHECK ((poids_moyen_actuel > (0)::numeric)),
    CONSTRAINT lots_poids_moyen_initial_check CHECK ((poids_moyen_initial > (0)::numeric)),
    CONSTRAINT lots_statut_check CHECK (((statut)::text = ANY ((ARRAY['en_preparation'::character varying, 'en_gavage'::character varying, 'termine'::character varying, 'abattu'::character varying])::text[]))),
    CONSTRAINT valid_date_range CHECK ((date_fin_gavage_prevue > date_debut_gavage))
);


ALTER TABLE public.lots OWNER TO gaveurs_admin;

--
-- Name: TABLE lots; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.lots IS 'Table principale du modèle LOT-centric. Un gaveur gère des LOTS de ~200 canards, pas des canards individuels.';


--
-- Name: lots_gavage; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.lots_gavage (
    id integer NOT NULL,
    code_lot character varying(20) NOT NULL,
    site_code character varying(2),
    gaveur_id integer,
    debut_lot date NOT NULL,
    duree_gavage_reelle integer,
    duree_du_lot integer,
    souche character varying(100),
    geo character varying(50),
    saison character varying(20),
    age_animaux integer,
    nb_meg integer,
    nb_enleve integer,
    nb_accroches integer,
    nb_morts integer,
    itm numeric(10,4),
    itm_cut character varying(1),
    sigma numeric(10,6),
    sigma_cut character varying(10),
    pctg_perte_gavage numeric(10,8),
    total_corn_target numeric(10,2),
    total_corn_real numeric(10,2),
    qte_total_test numeric(10,2),
    conso_gav_z1 numeric(10,3),
    code_plan_alimentation character varying(100),
    code_plan_alimentation_compl character varying(100),
    four_alim_elev character varying(100),
    four_alim_gav character varying(100),
    eleveur character varying(200),
    prod_igp_fr character varying(100),
    lot_gav character varying(20),
    lot_pag character varying(20),
    statut character varying(20) DEFAULT 'termine'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    genetique character varying(50),
    nb_canards_initial integer,
    poids_moyen_actuel numeric(8,2),
    taux_mortalite numeric(5,2) DEFAULT 0.0,
    jour_actuel integer DEFAULT '-1'::integer,
    pret_abattage boolean DEFAULT false
);


ALTER TABLE public.lots_gavage OWNER TO gaveurs_admin;

--
-- Name: TABLE lots_gavage; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.lots_gavage IS 'Lots de gavage avec toutes les données CSV (174 colonnes)';


--
-- Name: COLUMN lots_gavage.itm; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.lots_gavage.itm IS 'Indice Technique Moyen (kg de foie/canard)';


--
-- Name: COLUMN lots_gavage.sigma; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.lots_gavage.sigma IS 'Écart type du poids des foies (homogénéité)';


--
-- Name: COLUMN lots_gavage.pctg_perte_gavage; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.lots_gavage.pctg_perte_gavage IS 'Pourcentage de mortalité pendant gavage';


--
-- Name: COLUMN lots_gavage.updated_at; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.lots_gavage.updated_at IS 'Dernière mise à jour du lot';


--
-- Name: COLUMN lots_gavage.genetique; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.lots_gavage.genetique IS 'Génétique des canards (Mulard, Barbarie, Pékin)';


--
-- Name: COLUMN lots_gavage.nb_canards_initial; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.lots_gavage.nb_canards_initial IS 'Nombre initial de canards dans le lot';


--
-- Name: COLUMN lots_gavage.poids_moyen_actuel; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.lots_gavage.poids_moyen_actuel IS 'Poids moyen actuel des canards vivants (grammes)';


--
-- Name: COLUMN lots_gavage.taux_mortalite; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.lots_gavage.taux_mortalite IS 'Taux de mortalité actuel (%)';


--
-- Name: COLUMN lots_gavage.jour_actuel; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.lots_gavage.jour_actuel IS 'Jour actuel du gavage (J-1 à J14)';


--
-- Name: COLUMN lots_gavage.pret_abattage; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.lots_gavage.pret_abattage IS 'Lot terminé et prêt pour abattage';


--
-- Name: lots_gavage_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.lots_gavage_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.lots_gavage_id_seq OWNER TO gaveurs_admin;

--
-- Name: lots_gavage_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.lots_gavage_id_seq OWNED BY public.lots_gavage.id;


--
-- Name: lots_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.lots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.lots_id_seq OWNER TO gaveurs_admin;

--
-- Name: lots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.lots_id_seq OWNED BY public.lots.id;


--
-- Name: lots_registry; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.lots_registry (
    lot_id character varying(50) NOT NULL,
    gaveur_id character varying(50) NOT NULL,
    nb_canards integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    gavage_status character varying(20) DEFAULT 'en_cours'::character varying NOT NULL,
    gavage_started_at timestamp without time zone,
    gavage_ended_at timestamp without time zone,
    current_day integer DEFAULT 0,
    itm_moyen double precision,
    sqal_samples text[] DEFAULT '{}'::text[],
    sqal_grades text[] DEFAULT '{}'::text[],
    consumer_feedbacks text[] DEFAULT '{}'::text[],
    average_rating double precision,
    blockchain_hash character varying(100),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT lots_registry_nb_canards_check CHECK ((nb_canards > 0))
);


ALTER TABLE public.lots_registry OWNER TO gaveurs_admin;

--
-- Name: TABLE lots_registry; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.lots_registry IS 'Registre centralisé des lots pour traçabilité complète Gavage → SQAL → Consumer';


--
-- Name: COLUMN lots_registry.sqal_samples; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.lots_registry.sqal_samples IS 'Array des sample_ids SQAL liés à ce lot';


--
-- Name: COLUMN lots_registry.consumer_feedbacks; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.lots_registry.consumer_feedbacks IS 'Array des feedback_ids consommateurs liés à ce lot';


--
-- Name: COLUMN lots_registry.average_rating; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.lots_registry.average_rating IS 'Note moyenne des feedbacks consommateurs (1-5)';


--
-- Name: ml_models; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.ml_models (
    id integer NOT NULL,
    genetique character varying(20) NOT NULL,
    formule_symbolique text NOT NULL,
    score_r2 numeric(5,4) NOT NULL,
    metadata jsonb,
    actif boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.ml_models OWNER TO gaveurs_admin;

--
-- Name: TABLE ml_models; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.ml_models IS 'Modèles de machine learning (régression symbolique)';


--
-- Name: ml_models_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.ml_models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.ml_models_id_seq OWNER TO gaveurs_admin;

--
-- Name: ml_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.ml_models_id_seq OWNED BY public.ml_models.id;


--
-- Name: mortalite; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.mortalite (
    id integer NOT NULL,
    canard_id integer NOT NULL,
    date_deces timestamp with time zone NOT NULL,
    cause text,
    poids_au_deces numeric(6,2),
    jours_gavage_effectues integer,
    rapport_veterinaire text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.mortalite OWNER TO gaveurs_admin;

--
-- Name: mortalite_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.mortalite_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.mortalite_id_seq OWNER TO gaveurs_admin;

--
-- Name: mortalite_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.mortalite_id_seq OWNED BY public.mortalite.id;


--
-- Name: performance_gaveurs; Type: VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE VIEW public.performance_gaveurs AS
 SELECT g.id,
    (((g.nom)::text || ' '::text) || (g.prenom)::text) AS gaveur,
    count(DISTINCT c.id) AS nombre_canards_total,
    count(DISTINCT
        CASE
            WHEN ((c.statut)::text = 'en_gavage'::text) THEN c.id
            ELSE NULL::integer
        END) AS canards_en_cours,
    count(DISTINCT
        CASE
            WHEN ((c.statut)::text = 'termine'::text) THEN c.id
            ELSE NULL::integer
        END) AS canards_termines,
    COALESCE(avg(
        CASE
            WHEN ((c.statut)::text = 'termine'::text) THEN ( SELECT gavage_data.poids_soir
               FROM public.gavage_data
              WHERE (gavage_data.canard_id = c.id)
              ORDER BY gavage_data."time" DESC
             LIMIT 1)
            ELSE NULL::numeric
        END), (0)::numeric) AS poids_moyen_final,
    COALESCE((((count(DISTINCT m.id))::numeric / (NULLIF(count(DISTINCT c.id), 0))::numeric) * (100)::numeric), (0)::numeric) AS taux_mortalite_pct,
    COALESCE(corrections_stats.nb_corrections, (0)::bigint) AS corrections_totales,
    COALESCE(corrections_stats.ecart_moyen, (0)::numeric) AS ecart_moyen_pct
   FROM (((public.gaveurs g
     LEFT JOIN public.canards c ON ((g.id = c.gaveur_id)))
     LEFT JOIN public.mortalite m ON ((c.id = m.canard_id)))
     LEFT JOIN LATERAL ( SELECT count(*) AS nb_corrections,
            avg(cd.ecart_pourcentage) AS ecart_moyen
           FROM (public.corrections_doses cd
             JOIN public.canards c2 ON ((cd.canard_id = c2.id)))
          WHERE ((c2.gaveur_id = g.id) AND (cd.date >= (now() - '30 days'::interval)))) corrections_stats ON (true))
  GROUP BY g.id, g.nom, g.prenom, corrections_stats.nb_corrections, corrections_stats.ecart_moyen;


ALTER TABLE public.performance_gaveurs OWNER TO gaveurs_admin;

--
-- Name: sites_euralis; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.sites_euralis (
    id integer NOT NULL,
    code character varying(2) NOT NULL,
    nom character varying(100) NOT NULL,
    region character varying(100),
    capacite_gavage_max integer,
    nb_gaveurs_actifs integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.sites_euralis OWNER TO gaveurs_admin;

--
-- Name: TABLE sites_euralis; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.sites_euralis IS 'Sites de production Euralis (Bretagne, Pays de Loire, Maubourguet)';


--
-- Name: performances_sites; Type: MATERIALIZED VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE MATERIALIZED VIEW public.performances_sites AS
 SELECT s.code AS site_code,
    s.nom AS site_nom,
    count(l.id) AS nb_lots_total,
    count(
        CASE
            WHEN ((l.statut)::text = 'en_cours'::text) THEN 1
            ELSE NULL::integer
        END) AS nb_lots_actifs,
    count(
        CASE
            WHEN ((l.statut)::text = 'termine'::text) THEN 1
            ELSE NULL::integer
        END) AS nb_lots_termines,
    avg(l.itm) AS itm_moyen,
    stddev(l.itm) AS itm_stddev,
    min(l.itm) AS itm_min,
    max(l.itm) AS itm_max,
    avg(l.sigma) AS sigma_moyen,
    stddev(l.sigma) AS sigma_stddev,
    avg(l.pctg_perte_gavage) AS mortalite_moyenne,
    max(l.pctg_perte_gavage) AS mortalite_max,
    sum((((l.nb_accroches)::numeric * l.itm) / (1000)::numeric)) AS production_totale_kg,
    avg(l.total_corn_real) AS conso_moyenne_mais,
    sum(l.nb_meg) AS total_canards_meg,
    sum(l.nb_accroches) AS total_canards_accroches,
    sum(l.nb_morts) AS total_canards_morts,
    avg(l.duree_gavage_reelle) AS duree_moyenne,
    min(l.debut_lot) AS premier_lot,
    max(l.debut_lot) AS dernier_lot,
    now() AS last_refresh
   FROM (public.sites_euralis s
     LEFT JOIN public.lots_gavage l ON (((s.code)::text = (l.site_code)::text)))
  GROUP BY s.code, s.nom
  WITH NO DATA;


ALTER TABLE public.performances_sites OWNER TO gaveurs_admin;

--
-- Name: MATERIALIZED VIEW performances_sites; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON MATERIALIZED VIEW public.performances_sites IS 'Agrégations performance par site (refresh périodique)';


--
-- Name: planning_abattages; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.planning_abattages (
    id integer NOT NULL,
    lot_id integer,
    site_code character varying(2),
    date_abattage_prevue date NOT NULL,
    date_abattage_reelle date,
    abattoir character varying(100),
    creneau_horaire character varying(20),
    nb_canards_prevu integer,
    nb_canards_reel integer,
    capacite_abattoir_jour integer,
    taux_utilisation_pct numeric(5,2),
    cout_transport numeric(10,2),
    distance_km numeric(6,2),
    priorite integer,
    statut character varying(20) DEFAULT 'planifie'::character varying,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.planning_abattages OWNER TO gaveurs_admin;

--
-- Name: TABLE planning_abattages; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.planning_abattages IS 'Planning optimisé des abattages (algorithme hongrois)';


--
-- Name: planning_abattages_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.planning_abattages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.planning_abattages_id_seq OWNER TO gaveurs_admin;

--
-- Name: planning_abattages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.planning_abattages_id_seq OWNED BY public.planning_abattages.id;


--
-- Name: predictions_courbes; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.predictions_courbes (
    id integer NOT NULL,
    canard_id integer NOT NULL,
    date_prediction timestamp with time zone NOT NULL,
    jours_gavage integer[],
    poids_predits numeric(6,2)[],
    doses_recommandees_matin numeric(6,2)[],
    doses_recommandees_soir numeric(6,2)[],
    confiance numeric(3,2),
    formule_symbolique text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT predictions_courbes_confiance_check CHECK (((confiance >= (0)::numeric) AND (confiance <= (1)::numeric)))
);


ALTER TABLE public.predictions_courbes OWNER TO gaveurs_admin;

--
-- Name: predictions_courbes_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.predictions_courbes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.predictions_courbes_id_seq OWNER TO gaveurs_admin;

--
-- Name: predictions_courbes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.predictions_courbes_id_seq OWNED BY public.predictions_courbes.id;


--
-- Name: previsions_production; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.previsions_production (
    id integer NOT NULL,
    site_code character varying(2),
    date_prevision date NOT NULL,
    horizon_jours integer NOT NULL,
    production_prevue_kg numeric(10,2),
    itm_prevu numeric(6,2),
    nb_lots_prevu integer,
    production_min_kg numeric(10,2),
    production_max_kg numeric(10,2),
    itm_min numeric(6,2),
    itm_max numeric(6,2),
    modele_version character varying(50),
    confidence numeric(5,4),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.previsions_production OWNER TO gaveurs_admin;

--
-- Name: TABLE previsions_production; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.previsions_production IS 'Prévisions Prophet à 7/30/90 jours';


--
-- Name: previsions_production_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.previsions_production_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.previsions_production_id_seq OWNER TO gaveurs_admin;

--
-- Name: previsions_production_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.previsions_production_id_seq OWNED BY public.previsions_production.id;


--
-- Name: sites_euralis_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.sites_euralis_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sites_euralis_id_seq OWNER TO gaveurs_admin;

--
-- Name: sites_euralis_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.sites_euralis_id_seq OWNED BY public.sites_euralis.id;


--
-- Name: sqal_alerts; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.sqal_alerts (
    "time" timestamp with time zone NOT NULL,
    alert_id integer NOT NULL,
    sample_id character varying(100),
    device_id character varying(100),
    lot_id integer,
    alert_type character varying(50) NOT NULL,
    severity character varying(20) NOT NULL,
    title character varying(200) NOT NULL,
    message text,
    defect_details jsonb,
    threshold_value numeric(10,4),
    actual_value numeric(10,4),
    deviation_pct numeric(6,2),
    acknowledged boolean DEFAULT false,
    acknowledged_by character varying(100),
    acknowledged_at timestamp with time zone,
    resolution_notes text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.sqal_alerts OWNER TO gaveurs_admin;

--
-- Name: TABLE sqal_alerts; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.sqal_alerts IS 'Alertes qualité temps réel (défauts, anomalies) - Hypertable';


--
-- Name: sqal_alerts_alert_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.sqal_alerts_alert_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sqal_alerts_alert_id_seq OWNER TO gaveurs_admin;

--
-- Name: sqal_alerts_alert_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.sqal_alerts_alert_id_seq OWNED BY public.sqal_alerts.alert_id;


--
-- Name: sqal_hourly_stats; Type: VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE VIEW public.sqal_hourly_stats AS
 SELECT _materialized_hypertable_17.bucket,
    _materialized_hypertable_17.device_id,
    _materialized_hypertable_17.sample_count,
    _materialized_hypertable_17.count_a_plus,
    _materialized_hypertable_17.count_a,
    _materialized_hypertable_17.count_b,
    _materialized_hypertable_17.count_c,
    _materialized_hypertable_17.count_reject,
    _materialized_hypertable_17.avg_quality_score,
    _materialized_hypertable_17.min_quality_score,
    _materialized_hypertable_17.max_quality_score,
    _materialized_hypertable_17.avg_freshness,
    _materialized_hypertable_17.avg_fat_quality,
    _materialized_hypertable_17.avg_oxidation,
    _materialized_hypertable_17.avg_volume,
    _materialized_hypertable_17.avg_uniformity,
    _materialized_hypertable_17.count_compliant,
    _materialized_hypertable_17.last_refresh
   FROM _timescaledb_internal._materialized_hypertable_17;


ALTER TABLE public.sqal_hourly_stats OWNER TO gaveurs_admin;

--
-- Name: sqal_ml_models; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.sqal_ml_models (
    model_id integer NOT NULL,
    model_name character varying(100) NOT NULL,
    model_type character varying(50) NOT NULL,
    model_version character varying(20),
    model_file_path text,
    model_size_mb numeric(10,2),
    accuracy numeric(5,4),
    precision_score numeric(5,4),
    recall_score numeric(5,4),
    f1_score numeric(5,4),
    training_samples_count integer,
    training_duration_seconds integer,
    training_loss numeric(10,6),
    validation_loss numeric(10,6),
    framework character varying(50),
    hyperparameters jsonb,
    features_used jsonb,
    status character varying(20) DEFAULT 'active'::character varying,
    is_production boolean DEFAULT false,
    trained_at timestamp with time zone DEFAULT now(),
    deployed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.sqal_ml_models OWNER TO gaveurs_admin;

--
-- Name: TABLE sqal_ml_models; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.sqal_ml_models IS 'Modèles IA/ML pour analyse qualité (CNN, etc.)';


--
-- Name: sqal_ml_models_model_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.sqal_ml_models_model_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sqal_ml_models_model_id_seq OWNER TO gaveurs_admin;

--
-- Name: sqal_ml_models_model_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.sqal_ml_models_model_id_seq OWNED BY public.sqal_ml_models.model_id;


--
-- Name: sqal_pending_lots; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.sqal_pending_lots (
    id integer NOT NULL,
    code_lot character varying(20) NOT NULL,
    gaveur_id integer,
    gaveur_nom character varying(100),
    site character varying(2),
    genetique character varying(50),
    poids_moyen_final numeric(8,2),
    nb_canards_final integer,
    taux_mortalite numeric(5,2),
    date_abattage timestamp with time zone NOT NULL,
    date_inspection_sqal timestamp with time zone,
    status character varying(20) DEFAULT 'pending'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.sqal_pending_lots OWNER TO gaveurs_admin;

--
-- Name: TABLE sqal_pending_lots; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.sqal_pending_lots IS 'File d''attente des lots terminés pour contrôle qualité SQAL';


--
-- Name: COLUMN sqal_pending_lots.status; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON COLUMN public.sqal_pending_lots.status IS 'pending: en attente | inspected: inspecté | approved: validé | rejected: refusé';


--
-- Name: sqal_pending_lots_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.sqal_pending_lots_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.sqal_pending_lots_id_seq OWNER TO gaveurs_admin;

--
-- Name: sqal_pending_lots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.sqal_pending_lots_id_seq OWNED BY public.sqal_pending_lots.id;


--
-- Name: sqal_site_stats; Type: VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE VIEW public.sqal_site_stats AS
 SELECT _materialized_hypertable_18.day,
    _materialized_hypertable_18.site_code,
    _materialized_hypertable_18.sample_count,
    _materialized_hypertable_18.count_a_plus,
    _materialized_hypertable_18.avg_quality_score,
    _materialized_hypertable_18.avg_freshness,
    _materialized_hypertable_18.compliance_rate_pct,
    _materialized_hypertable_18.last_refresh
   FROM _timescaledb_internal._materialized_hypertable_18;


ALTER TABLE public.sqal_site_stats OWNER TO gaveurs_admin;

--
-- Name: statistiques_globales; Type: TABLE; Schema: public; Owner: gaveurs_admin
--

CREATE TABLE public.statistiques_globales (
    id integer NOT NULL,
    site_code character varying(2),
    periode character varying(20) NOT NULL,
    date_debut date NOT NULL,
    date_fin date NOT NULL,
    nb_lots integer,
    nb_gaveurs_actifs integer,
    production_totale_kg numeric(12,2),
    itm_moyen numeric(6,2),
    sigma_moyen numeric(6,4),
    mortalite_moyenne numeric(6,4),
    tendance_itm character varying(10),
    tendance_mortalite character varying(10),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.statistiques_globales OWNER TO gaveurs_admin;

--
-- Name: TABLE statistiques_globales; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TABLE public.statistiques_globales IS 'Statistiques pré-calculées pour dashboard (cache)';


--
-- Name: statistiques_globales_id_seq; Type: SEQUENCE; Schema: public; Owner: gaveurs_admin
--

CREATE SEQUENCE public.statistiques_globales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.statistiques_globales_id_seq OWNER TO gaveurs_admin;

--
-- Name: statistiques_globales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: gaveurs_admin
--

ALTER SEQUENCE public.statistiques_globales_id_seq OWNED BY public.statistiques_globales.id;


--
-- Name: v_active_lots_summary; Type: VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE VIEW public.v_active_lots_summary AS
 SELECT count(*) AS total_active_lots,
    sum(lots_registry.nb_canards) AS total_active_canards,
    avg(lots_registry.current_day) AS avg_gavage_day,
    avg(lots_registry.itm_moyen) AS avg_itm,
    min(lots_registry.created_at) AS oldest_lot_date,
    max(lots_registry.created_at) AS newest_lot_date
   FROM public.lots_registry
  WHERE ((lots_registry.gavage_status)::text = 'en_cours'::text);


ALTER TABLE public.v_active_lots_summary OWNER TO gaveurs_admin;

--
-- Name: v_completed_lots_summary; Type: VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE VIEW public.v_completed_lots_summary AS
 SELECT count(*) AS total_completed_lots,
    sum(lots_registry.nb_canards) AS total_completed_canards,
    avg(lots_registry.current_day) AS avg_gavage_duration,
    avg(lots_registry.itm_moyen) AS avg_final_itm,
    avg(lots_registry.average_rating) AS avg_consumer_rating,
    avg(cardinality(lots_registry.sqal_samples)) AS avg_sqal_controls_per_lot
   FROM public.lots_registry
  WHERE ((lots_registry.gavage_status)::text = 'termine'::text);


ALTER TABLE public.v_completed_lots_summary OWNER TO gaveurs_admin;

--
-- Name: v_gaveurs_actifs_par_site; Type: VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE VIEW public.v_gaveurs_actifs_par_site AS
 SELECT s.code,
    s.nom,
    s.region,
    s.capacite_gavage_max,
    count(DISTINCT l.gaveur_id) AS nb_gaveurs_actifs_reel,
    count(DISTINCT
        CASE
            WHEN ((l.statut)::text = 'en_cours'::text) THEN l.id
            ELSE NULL::integer
        END) AS nb_lots_actifs
   FROM (public.sites_euralis s
     LEFT JOIN public.lots_gavage l ON (((s.code)::text = (l.site_code)::text)))
  GROUP BY s.code, s.nom, s.region, s.capacite_gavage_max
  ORDER BY s.code;


ALTER TABLE public.v_gaveurs_actifs_par_site OWNER TO gaveurs_admin;

--
-- Name: v_lot_traceability; Type: VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE VIEW public.v_lot_traceability AS
 SELECT l.lot_id,
    l.gaveur_id,
    l.nb_canards,
    l.gavage_status,
    l.current_day,
    l.itm_moyen,
    cardinality(l.sqal_samples) AS sqal_control_count,
    cardinality(l.consumer_feedbacks) AS feedback_count,
    l.average_rating,
    l.created_at,
    l.gavage_started_at,
    l.gavage_ended_at,
    COALESCE((EXTRACT(epoch FROM (l.gavage_ended_at - l.gavage_started_at)) / (86400)::numeric), (EXTRACT(epoch FROM (now() - (l.gavage_started_at)::timestamp with time zone)) / (86400)::numeric)) AS gavage_duration_days,
    ( SELECT count(*) AS count
           FROM public.lot_events e
          WHERE ((e.lot_id)::text = (l.lot_id)::text)) AS total_events
   FROM public.lots_registry l
  ORDER BY l.created_at DESC;


ALTER TABLE public.v_lot_traceability OWNER TO gaveurs_admin;

--
-- Name: v_lots_actifs_realtime; Type: VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE VIEW public.v_lots_actifs_realtime AS
 SELECT l.code_lot,
    l.site_code AS site,
    l.gaveur_id,
    g.nom AS gaveur_nom,
    l.genetique,
    l.nb_canards_initial,
    l.poids_moyen_actuel,
    l.taux_mortalite,
    l.jour_actuel,
    l.debut_lot,
    l.pret_abattage,
    l.updated_at,
    ( SELECT doses_journalieres.dose_reelle
           FROM public.doses_journalieres
          WHERE ((doses_journalieres.code_lot)::text = (l.code_lot)::text)
          ORDER BY doses_journalieres."time" DESC
         LIMIT 1) AS derniere_dose,
    ( SELECT count(*) AS count
           FROM public.doses_journalieres
          WHERE ((doses_journalieres.code_lot)::text = (l.code_lot)::text)) AS nb_gavages_effectues
   FROM (public.lots_gavage l
     LEFT JOIN public.gaveurs_euralis g ON ((l.gaveur_id = g.id)))
  WHERE ((l.pret_abattage = false) AND (l.jour_actuel >= '-1'::integer))
  ORDER BY l.updated_at DESC;


ALTER TABLE public.v_lots_actifs_realtime OWNER TO gaveurs_admin;

--
-- Name: VIEW v_lots_actifs_realtime; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON VIEW public.v_lots_actifs_realtime IS 'Vue temps réel des lots de gavage actifs';


--
-- Name: v_stats_realtime_sites; Type: VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE VIEW public.v_stats_realtime_sites AS
 SELECT lots_gavage.site_code AS site,
    count(*) AS nb_lots_actifs,
    sum(lots_gavage.nb_canards_initial) AS total_canards_initial,
    sum(((lots_gavage.nb_canards_initial)::numeric * ((1)::numeric - (lots_gavage.taux_mortalite / 100.0)))) AS total_canards_vivants_estim,
    avg(lots_gavage.poids_moyen_actuel) AS poids_moyen_global,
    avg(lots_gavage.taux_mortalite) AS taux_mortalite_moyen,
    avg(lots_gavage.jour_actuel) AS jour_moyen,
    max(lots_gavage.updated_at) AS derniere_mise_a_jour
   FROM public.lots_gavage
  WHERE ((lots_gavage.pret_abattage = false) AND (lots_gavage.jour_actuel >= 0))
  GROUP BY lots_gavage.site_code
  ORDER BY lots_gavage.site_code;


ALTER TABLE public.v_stats_realtime_sites OWNER TO gaveurs_admin;

--
-- Name: VIEW v_stats_realtime_sites; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON VIEW public.v_stats_realtime_sites IS 'Statistiques temps réel agrégées par site Euralis';


--
-- Name: _hyper_16_27_chunk fusion_is_compliant; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_16_27_chunk ALTER COLUMN fusion_is_compliant SET DEFAULT true;


--
-- Name: _hyper_16_27_chunk created_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_16_27_chunk ALTER COLUMN created_at SET DEFAULT now();


--
-- Name: _hyper_1_24_chunk created_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_1_24_chunk ALTER COLUMN created_at SET DEFAULT now();


--
-- Name: _hyper_1_25_chunk created_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_1_25_chunk ALTER COLUMN created_at SET DEFAULT now();


--
-- Name: _hyper_22_22_chunk id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_22_chunk ALTER COLUMN id SET DEFAULT nextval('public.gavage_lot_quotidien_id_seq'::regclass);


--
-- Name: _hyper_22_22_chunk suit_courbe_theorique; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_22_chunk ALTER COLUMN suit_courbe_theorique SET DEFAULT true;


--
-- Name: _hyper_22_22_chunk mortalite_jour; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_22_chunk ALTER COLUMN mortalite_jour SET DEFAULT 0;


--
-- Name: _hyper_22_22_chunk alerte_generee; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_22_chunk ALTER COLUMN alerte_generee SET DEFAULT false;


--
-- Name: _hyper_22_22_chunk prediction_activee; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_22_chunk ALTER COLUMN prediction_activee SET DEFAULT false;


--
-- Name: _hyper_22_22_chunk created_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_22_chunk ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: _hyper_22_26_chunk id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_26_chunk ALTER COLUMN id SET DEFAULT nextval('public.gavage_lot_quotidien_id_seq'::regclass);


--
-- Name: _hyper_22_26_chunk suit_courbe_theorique; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_26_chunk ALTER COLUMN suit_courbe_theorique SET DEFAULT true;


--
-- Name: _hyper_22_26_chunk mortalite_jour; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_26_chunk ALTER COLUMN mortalite_jour SET DEFAULT 0;


--
-- Name: _hyper_22_26_chunk alerte_generee; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_26_chunk ALTER COLUMN alerte_generee SET DEFAULT false;


--
-- Name: _hyper_22_26_chunk prediction_activee; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_26_chunk ALTER COLUMN prediction_activee SET DEFAULT false;


--
-- Name: _hyper_22_26_chunk created_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_26_chunk ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: _hyper_22_6_chunk id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_6_chunk ALTER COLUMN id SET DEFAULT nextval('public.gavage_lot_quotidien_id_seq'::regclass);


--
-- Name: _hyper_22_6_chunk suit_courbe_theorique; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_6_chunk ALTER COLUMN suit_courbe_theorique SET DEFAULT true;


--
-- Name: _hyper_22_6_chunk mortalite_jour; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_6_chunk ALTER COLUMN mortalite_jour SET DEFAULT 0;


--
-- Name: _hyper_22_6_chunk alerte_generee; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_6_chunk ALTER COLUMN alerte_generee SET DEFAULT false;


--
-- Name: _hyper_22_6_chunk prediction_activee; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_6_chunk ALTER COLUMN prediction_activee SET DEFAULT false;


--
-- Name: _hyper_22_6_chunk created_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_6_chunk ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: _hyper_22_7_chunk id; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_7_chunk ALTER COLUMN id SET DEFAULT nextval('public.gavage_lot_quotidien_id_seq'::regclass);


--
-- Name: _hyper_22_7_chunk suit_courbe_theorique; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_7_chunk ALTER COLUMN suit_courbe_theorique SET DEFAULT true;


--
-- Name: _hyper_22_7_chunk mortalite_jour; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_7_chunk ALTER COLUMN mortalite_jour SET DEFAULT 0;


--
-- Name: _hyper_22_7_chunk alerte_generee; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_7_chunk ALTER COLUMN alerte_generee SET DEFAULT false;


--
-- Name: _hyper_22_7_chunk prediction_activee; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_7_chunk ALTER COLUMN prediction_activee SET DEFAULT false;


--
-- Name: _hyper_22_7_chunk created_at; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_7_chunk ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: _hyper_24_219_chunk nb_canards_morts; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_24_219_chunk ALTER COLUMN nb_canards_morts SET DEFAULT 0;


--
-- Name: _hyper_24_219_chunk taux_mortalite; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_24_219_chunk ALTER COLUMN taux_mortalite SET DEFAULT 0.0;


--
-- Name: _hyper_24_220_chunk nb_canards_morts; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_24_220_chunk ALTER COLUMN nb_canards_morts SET DEFAULT 0;


--
-- Name: _hyper_24_220_chunk taux_mortalite; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_24_220_chunk ALTER COLUMN taux_mortalite SET DEFAULT 0.0;


--
-- Name: _hyper_5_2_chunk alerte_generee; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_5_2_chunk ALTER COLUMN alerte_generee SET DEFAULT false;


--
-- Name: _hyper_5_3_chunk alerte_generee; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_5_3_chunk ALTER COLUMN alerte_generee SET DEFAULT false;


--
-- Name: _hyper_9_1_chunk sms_envoye; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_9_1_chunk ALTER COLUMN sms_envoye SET DEFAULT false;


--
-- Name: _hyper_9_1_chunk acquittee; Type: DEFAULT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_9_1_chunk ALTER COLUMN acquittee SET DEFAULT false;


--
-- Name: abattoirs id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.abattoirs ALTER COLUMN id SET DEFAULT nextval('public.abattoirs_id_seq'::regclass);


--
-- Name: alertes_euralis id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.alertes_euralis ALTER COLUMN id SET DEFAULT nextval('public.alertes_euralis_id_seq'::regclass);


--
-- Name: anomalies_detectees id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.anomalies_detectees ALTER COLUMN id SET DEFAULT nextval('public.anomalies_detectees_id_seq'::regclass);


--
-- Name: bug_metrics id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.bug_metrics ALTER COLUMN id SET DEFAULT nextval('public.bug_metrics_id_seq'::regclass);


--
-- Name: canards id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.canards ALTER COLUMN id SET DEFAULT nextval('public.canards_id_seq'::regclass);


--
-- Name: consumer_feedback_ml_data ml_data_id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.consumer_feedback_ml_data ALTER COLUMN ml_data_id SET DEFAULT nextval('public.consumer_feedback_ml_data_ml_data_id_seq'::regclass);


--
-- Name: consumer_feedback_ml_insights insight_id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.consumer_feedback_ml_insights ALTER COLUMN insight_id SET DEFAULT nextval('public.consumer_feedback_ml_insights_insight_id_seq'::regclass);


--
-- Name: consumer_feedbacks feedback_id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.consumer_feedbacks ALTER COLUMN feedback_id SET DEFAULT nextval('public.consumer_feedbacks_feedback_id_seq'::regclass);


--
-- Name: corrections_doses id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.corrections_doses ALTER COLUMN id SET DEFAULT nextval('public.corrections_doses_id_seq'::regclass);


--
-- Name: formules_pysr id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.formules_pysr ALTER COLUMN id SET DEFAULT nextval('public.formules_pysr_id_seq'::regclass);


--
-- Name: gavage_lot_quotidien id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.gavage_lot_quotidien ALTER COLUMN id SET DEFAULT nextval('public.gavage_lot_quotidien_id_seq'::regclass);


--
-- Name: gaveurs id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.gaveurs ALTER COLUMN id SET DEFAULT nextval('public.gaveurs_id_seq'::regclass);


--
-- Name: gaveurs_clusters id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.gaveurs_clusters ALTER COLUMN id SET DEFAULT nextval('public.gaveurs_clusters_id_seq'::regclass);


--
-- Name: gaveurs_euralis id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.gaveurs_euralis ALTER COLUMN id SET DEFAULT nextval('public.gaveurs_euralis_id_seq'::regclass);


--
-- Name: lot_events id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.lot_events ALTER COLUMN id SET DEFAULT nextval('public.lot_events_id_seq'::regclass);


--
-- Name: lot_mais id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.lot_mais ALTER COLUMN id SET DEFAULT nextval('public.lot_mais_id_seq'::regclass);


--
-- Name: lots id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.lots ALTER COLUMN id SET DEFAULT nextval('public.lots_id_seq'::regclass);


--
-- Name: lots_gavage id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.lots_gavage ALTER COLUMN id SET DEFAULT nextval('public.lots_gavage_id_seq'::regclass);


--
-- Name: ml_models id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.ml_models ALTER COLUMN id SET DEFAULT nextval('public.ml_models_id_seq'::regclass);


--
-- Name: mortalite id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.mortalite ALTER COLUMN id SET DEFAULT nextval('public.mortalite_id_seq'::regclass);


--
-- Name: planning_abattages id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.planning_abattages ALTER COLUMN id SET DEFAULT nextval('public.planning_abattages_id_seq'::regclass);


--
-- Name: predictions_courbes id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.predictions_courbes ALTER COLUMN id SET DEFAULT nextval('public.predictions_courbes_id_seq'::regclass);


--
-- Name: previsions_production id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.previsions_production ALTER COLUMN id SET DEFAULT nextval('public.previsions_production_id_seq'::regclass);


--
-- Name: sites_euralis id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.sites_euralis ALTER COLUMN id SET DEFAULT nextval('public.sites_euralis_id_seq'::regclass);


--
-- Name: sqal_alerts alert_id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.sqal_alerts ALTER COLUMN alert_id SET DEFAULT nextval('public.sqal_alerts_alert_id_seq'::regclass);


--
-- Name: sqal_ml_models model_id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.sqal_ml_models ALTER COLUMN model_id SET DEFAULT nextval('public.sqal_ml_models_model_id_seq'::regclass);


--
-- Name: sqal_pending_lots id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.sqal_pending_lots ALTER COLUMN id SET DEFAULT nextval('public.sqal_pending_lots_id_seq'::regclass);


--
-- Name: statistiques_globales id; Type: DEFAULT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.statistiques_globales ALTER COLUMN id SET DEFAULT nextval('public.statistiques_globales_id_seq'::regclass);


--
-- Data for Name: hypertable; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

COPY _timescaledb_catalog.hypertable (id, schema_name, table_name, associated_schema_name, associated_table_prefix, num_dimensions, chunk_sizing_func_schema, chunk_sizing_func_name, chunk_target_size, compression_state, compressed_hypertable_id, status) FROM stdin;
3	_timescaledb_internal	_compressed_hypertable_3	_timescaledb_internal	_hyper_3	0	_timescaledb_functions	calculate_chunk_interval	0	2	\N	0
1	public	doses_journalieres	_timescaledb_internal	_hyper_1	1	_timescaledb_functions	calculate_chunk_interval	0	1	3	0
4	_timescaledb_internal	_compressed_hypertable_4	_timescaledb_internal	_hyper_4	0	_timescaledb_functions	calculate_chunk_interval	0	2	\N	0
2	public	alertes_euralis	_timescaledb_internal	_hyper_2	1	_timescaledb_functions	calculate_chunk_interval	0	1	4	0
6	_timescaledb_internal	_compressed_hypertable_6	_timescaledb_internal	_hyper_6	0	_timescaledb_functions	calculate_chunk_interval	0	2	\N	0
5	public	gavage_data	_timescaledb_internal	_hyper_5	1	_timescaledb_functions	calculate_chunk_interval	0	1	6	0
7	_timescaledb_internal	_materialized_hypertable_7	_timescaledb_internal	_hyper_7	1	_timescaledb_functions	calculate_chunk_interval	0	0	\N	0
8	_timescaledb_internal	_materialized_hypertable_8	_timescaledb_internal	_hyper_8	1	_timescaledb_functions	calculate_chunk_interval	0	0	\N	0
10	public	blockchain	_timescaledb_internal	_hyper_10	1	_timescaledb_functions	calculate_chunk_interval	0	0	\N	0
11	_timescaledb_internal	_compressed_hypertable_11	_timescaledb_internal	_hyper_11	0	_timescaledb_functions	calculate_chunk_interval	0	2	\N	0
9	public	alertes	_timescaledb_internal	_hyper_9	1	_timescaledb_functions	calculate_chunk_interval	0	1	11	0
13	_timescaledb_internal	_compressed_hypertable_13	_timescaledb_internal	_hyper_13	0	_timescaledb_functions	calculate_chunk_interval	0	2	\N	0
12	public	consumer_feedbacks	_timescaledb_internal	_hyper_12	1	_timescaledb_functions	calculate_chunk_interval	0	1	13	0
14	_timescaledb_internal	_materialized_hypertable_14	_timescaledb_internal	_hyper_14	1	_timescaledb_functions	calculate_chunk_interval	0	0	\N	0
15	_timescaledb_internal	_materialized_hypertable_15	_timescaledb_internal	_hyper_15	1	_timescaledb_functions	calculate_chunk_interval	0	0	\N	0
17	_timescaledb_internal	_materialized_hypertable_17	_timescaledb_internal	_hyper_17	1	_timescaledb_functions	calculate_chunk_interval	0	0	\N	0
18	_timescaledb_internal	_materialized_hypertable_18	_timescaledb_internal	_hyper_18	1	_timescaledb_functions	calculate_chunk_interval	0	0	\N	0
20	_timescaledb_internal	_compressed_hypertable_20	_timescaledb_internal	_hyper_20	0	_timescaledb_functions	calculate_chunk_interval	0	2	\N	0
16	public	sqal_sensor_samples	_timescaledb_internal	_hyper_16	1	_timescaledb_functions	calculate_chunk_interval	0	1	20	0
21	_timescaledb_internal	_compressed_hypertable_21	_timescaledb_internal	_hyper_21	0	_timescaledb_functions	calculate_chunk_interval	0	2	\N	0
19	public	sqal_alerts	_timescaledb_internal	_hyper_19	1	_timescaledb_functions	calculate_chunk_interval	0	1	21	0
22	public	gavage_lot_quotidien	_timescaledb_internal	_hyper_22	1	_timescaledb_functions	calculate_chunk_interval	0	0	\N	0
23	_timescaledb_internal	_materialized_hypertable_23	_timescaledb_internal	_hyper_23	1	_timescaledb_functions	calculate_chunk_interval	0	0	\N	0
24	public	gavage_data_lots	_timescaledb_internal	_hyper_24	1	_timescaledb_functions	calculate_chunk_interval	0	0	\N	0
\.


--
-- Data for Name: chunk; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

COPY _timescaledb_catalog.chunk (id, hypertable_id, schema_name, table_name, compressed_chunk_id, dropped, status, osm_chunk, creation_time) FROM stdin;
1	9	_timescaledb_internal	_hyper_9_1_chunk	\N	f	0	f	2025-12-26 10:57:46.449144+00
3	5	_timescaledb_internal	_hyper_5_3_chunk	\N	f	0	f	2025-12-26 10:59:01.628784+00
4	7	_timescaledb_internal	_hyper_7_4_chunk	\N	f	0	f	2025-12-26 11:36:31.48179+00
6	22	_timescaledb_internal	_hyper_22_6_chunk	\N	f	0	f	2025-12-28 18:50:27.140137+00
7	22	_timescaledb_internal	_hyper_22_7_chunk	\N	f	0	f	2025-12-28 18:50:58.853507+00
8	23	_timescaledb_internal	_hyper_23_8_chunk	\N	f	0	f	2025-12-30 07:03:43.097515+00
22	22	_timescaledb_internal	_hyper_22_22_chunk	\N	f	0	f	2025-12-31 19:21:00.885474+00
23	6	_timescaledb_internal	compress_hyper_6_23_chunk	\N	f	0	f	2026-01-01 08:28:28.625561+00
2	5	_timescaledb_internal	_hyper_5_2_chunk	23	f	1	f	2025-12-26 10:59:01.563034+00
24	1	_timescaledb_internal	_hyper_1_24_chunk	\N	f	0	f	2026-01-01 11:19:52.022001+00
25	1	_timescaledb_internal	_hyper_1_25_chunk	\N	f	0	f	2026-01-01 11:19:52.121087+00
26	22	_timescaledb_internal	_hyper_22_26_chunk	\N	f	0	f	2026-01-01 14:29:29.618978+00
27	16	_timescaledb_internal	_hyper_16_27_chunk	\N	f	0	f	2026-01-02 08:57:12.946259+00
28	17	_timescaledb_internal	_hyper_17_28_chunk	\N	f	0	f	2026-01-02 10:31:14.940081+00
29	18	_timescaledb_internal	_hyper_18_29_chunk	\N	f	0	f	2026-01-03 10:01:36.122641+00
219	24	_timescaledb_internal	_hyper_24_219_chunk	\N	f	0	f	2026-01-07 19:29:40.414027+00
220	24	_timescaledb_internal	_hyper_24_220_chunk	\N	f	0	f	2026-01-08 07:13:05.089951+00
\.


--
-- Data for Name: chunk_column_stats; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

COPY _timescaledb_catalog.chunk_column_stats (id, hypertable_id, chunk_id, column_name, range_start, range_end, valid) FROM stdin;
\.


--
-- Data for Name: dimension; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

COPY _timescaledb_catalog.dimension (id, hypertable_id, column_name, column_type, aligned, num_slices, partitioning_func_schema, partitioning_func, interval_length, compress_interval_length, integer_now_func_schema, integer_now_func) FROM stdin;
1	1	time	timestamp with time zone	t	\N	\N	\N	604800000000	\N	\N	\N
2	2	time	timestamp with time zone	t	\N	\N	\N	604800000000	\N	\N	\N
3	5	time	timestamp with time zone	t	\N	\N	\N	604800000000	\N	\N	\N
4	7	day	timestamp with time zone	t	\N	\N	\N	6048000000000	\N	\N	\N
5	8	week	timestamp with time zone	t	\N	\N	\N	6048000000000	\N	\N	\N
6	9	time	timestamp with time zone	t	\N	\N	\N	604800000000	\N	\N	\N
7	10	timestamp	timestamp with time zone	t	\N	\N	\N	604800000000	\N	\N	\N
8	12	time	timestamp with time zone	t	\N	\N	\N	604800000000	\N	\N	\N
9	14	bucket	timestamp with time zone	t	\N	\N	\N	6048000000000	\N	\N	\N
10	15	bucket	timestamp with time zone	t	\N	\N	\N	6048000000000	\N	\N	\N
11	16	time	timestamp with time zone	t	\N	\N	\N	604800000000	\N	\N	\N
12	17	bucket	timestamp with time zone	t	\N	\N	\N	6048000000000	\N	\N	\N
13	18	day	timestamp with time zone	t	\N	\N	\N	6048000000000	\N	\N	\N
14	19	time	timestamp with time zone	t	\N	\N	\N	604800000000	\N	\N	\N
15	22	date_gavage	date	t	\N	\N	\N	604800000000	\N	\N	\N
16	23	jour	date	t	\N	\N	\N	6048000000000	\N	\N	\N
17	24	time	timestamp with time zone	t	\N	\N	\N	604800000000	\N	\N	\N
\.


--
-- Data for Name: dimension_slice; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

COPY _timescaledb_catalog.dimension_slice (id, dimension_id, range_start, range_end) FROM stdin;
1	6	1766620800000000	1767225600000000
2	3	1766016000000000	1766620800000000
3	3	1766620800000000	1767225600000000
4	4	1766016000000000	1772064000000000
6	15	1735171200000000	1735776000000000
7	15	1766620800000000	1767225600000000
8	16	1766016000000000	1772064000000000
22	15	1766016000000000	1766620800000000
23	1	1767225600000000	1767830400000000
24	1	1766620800000000	1767225600000000
25	15	1767225600000000	1767830400000000
26	11	1767225600000000	1767830400000000
27	12	1766016000000000	1772064000000000
28	13	1766016000000000	1772064000000000
218	17	1767225600000000	1767830400000000
219	17	1767830400000000	1768435200000000
\.


--
-- Data for Name: chunk_constraint; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

COPY _timescaledb_catalog.chunk_constraint (chunk_id, dimension_slice_id, constraint_name, hypertable_constraint_name) FROM stdin;
1	1	constraint_1	\N
1	\N	1_1_alertes_acquittee_par_fkey	alertes_acquittee_par_fkey
1	\N	1_2_alertes_canard_id_fkey	alertes_canard_id_fkey
1	\N	1_3_alertes_pkey	alertes_pkey
2	2	constraint_2	\N
2	\N	2_4_gavage_data_canard_id_fkey	gavage_data_canard_id_fkey
2	\N	2_5_gavage_data_lot_mais_id_fkey	gavage_data_lot_mais_id_fkey
2	\N	2_6_gavage_data_pkey	gavage_data_pkey
3	3	constraint_3	\N
3	\N	3_7_gavage_data_canard_id_fkey	gavage_data_canard_id_fkey
3	\N	3_8_gavage_data_lot_mais_id_fkey	gavage_data_lot_mais_id_fkey
3	\N	3_9_gavage_data_pkey	gavage_data_pkey
4	4	constraint_4	\N
219	218	constraint_218	\N
219	\N	219_614_gavage_data_lots_lot_fkey	gavage_data_lots_lot_fkey
219	\N	219_615_gavage_data_lots_pkey	gavage_data_lots_pkey
6	6	constraint_6	\N
6	\N	6_12_gavage_lot_quotidien_lot_id_fkey	gavage_lot_quotidien_lot_id_fkey
6	\N	6_13_unique_lot_date	unique_lot_date
7	7	constraint_7	\N
7	\N	7_14_gavage_lot_quotidien_lot_id_fkey	gavage_lot_quotidien_lot_id_fkey
7	\N	7_15_unique_lot_date	unique_lot_date
8	8	constraint_8	\N
220	219	constraint_219	\N
220	\N	220_616_gavage_data_lots_lot_fkey	gavage_data_lots_lot_fkey
220	\N	220_617_gavage_data_lots_pkey	gavage_data_lots_pkey
22	22	constraint_22	\N
22	\N	22_42_gavage_lot_quotidien_lot_id_fkey	gavage_lot_quotidien_lot_id_fkey
22	\N	22_43_unique_lot_date	unique_lot_date
24	23	constraint_23	\N
24	\N	24_44_doses_journalieres_lot_id_fkey	doses_journalieres_lot_id_fkey
24	\N	24_45_doses_journalieres_pkey	doses_journalieres_pkey
25	24	constraint_24	\N
25	\N	25_46_doses_journalieres_lot_id_fkey	doses_journalieres_lot_id_fkey
25	\N	25_47_doses_journalieres_pkey	doses_journalieres_pkey
26	25	constraint_25	\N
26	\N	26_48_gavage_lot_quotidien_lot_id_fkey	gavage_lot_quotidien_lot_id_fkey
26	\N	26_49_unique_lot_date	unique_lot_date
27	26	constraint_26	\N
27	\N	27_50_sqal_sensor_samples_device_id_fkey	sqal_sensor_samples_device_id_fkey
27	\N	27_51_sqal_sensor_samples_lot_id_fkey	sqal_sensor_samples_lot_id_fkey
27	\N	27_52_sqal_sensor_samples_pkey	sqal_sensor_samples_pkey
28	27	constraint_27	\N
29	28	constraint_28	\N
\.


--
-- Data for Name: compression_chunk_size; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

COPY _timescaledb_catalog.compression_chunk_size (chunk_id, compressed_chunk_id, uncompressed_heap_size, uncompressed_toast_size, uncompressed_index_size, compressed_heap_size, compressed_toast_size, compressed_index_size, numrows_pre_compression, numrows_post_compression, numrows_frozen_immediately) FROM stdin;
2	23	49152	8192	57344	57344	8192	16384	125	25	25
\.


--
-- Data for Name: compression_settings; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

COPY _timescaledb_catalog.compression_settings (relid, compress_relid, segmentby, orderby, orderby_desc, orderby_nullsfirst, index) FROM stdin;
public.doses_journalieres	\N	{lot_id}	\N	\N	\N	\N
public.alertes_euralis	\N	{site_code,type_alerte}	\N	\N	\N	\N
public.gavage_data	\N	{canard_id}	{time}	{t}	{t}	\N
public.alertes	\N	{canard_id,niveau}	\N	\N	\N	\N
public.consumer_feedbacks	\N	{product_id}	{time}	{t}	{t}	\N
public.sqal_sensor_samples	\N	{device_id}	{time}	{t}	{t}	\N
public.sqal_alerts	\N	{device_id,alert_type}	{time}	{t}	{t}	\N
_timescaledb_internal._hyper_5_2_chunk	_timescaledb_internal.compress_hyper_6_23_chunk	{canard_id}	{time}	{t}	{t}	[{"type": "minmax", "column": "alerte_generee", "source": "default"}, {"type": "minmax", "column": "time", "source": "orderby"}]
\.


--
-- Data for Name: continuous_agg; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

COPY _timescaledb_catalog.continuous_agg (mat_hypertable_id, raw_hypertable_id, parent_mat_hypertable_id, user_view_schema, user_view_name, partial_view_schema, partial_view_name, direct_view_schema, direct_view_name, materialized_only, finalized) FROM stdin;
7	5	\N	public	gavage_daily_stats	_timescaledb_internal	_partial_view_7	_timescaledb_internal	_direct_view_7	t	t
8	5	\N	public	gavage_weekly_genetics	_timescaledb_internal	_partial_view_8	_timescaledb_internal	_direct_view_8	t	t
14	12	\N	public	consumer_lot_stats	_timescaledb_internal	_partial_view_14	_timescaledb_internal	_direct_view_14	t	t
15	12	\N	public	consumer_site_stats	_timescaledb_internal	_partial_view_15	_timescaledb_internal	_direct_view_15	t	t
17	16	\N	public	sqal_hourly_stats	_timescaledb_internal	_partial_view_17	_timescaledb_internal	_direct_view_17	t	t
18	16	\N	public	sqal_site_stats	_timescaledb_internal	_partial_view_18	_timescaledb_internal	_direct_view_18	t	t
23	22	\N	public	evolution_quotidienne_lots	_timescaledb_internal	_partial_view_23	_timescaledb_internal	_direct_view_23	t	t
\.


--
-- Data for Name: continuous_agg_migrate_plan; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

COPY _timescaledb_catalog.continuous_agg_migrate_plan (mat_hypertable_id, start_ts, end_ts, user_view_definition) FROM stdin;
\.


--
-- Data for Name: continuous_agg_migrate_plan_step; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

COPY _timescaledb_catalog.continuous_agg_migrate_plan_step (mat_hypertable_id, step_id, status, start_ts, end_ts, type, config) FROM stdin;
\.


--
-- Data for Name: continuous_aggs_bucket_function; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

COPY _timescaledb_catalog.continuous_aggs_bucket_function (mat_hypertable_id, bucket_func, bucket_width, bucket_origin, bucket_offset, bucket_timezone, bucket_fixed_width) FROM stdin;
7	public.time_bucket(interval,timestamp with time zone)	1 day	\N	\N	\N	t
8	public.time_bucket(interval,timestamp with time zone)	7 days	\N	\N	\N	t
14	public.time_bucket(interval,timestamp with time zone)	1 day	\N	\N	\N	t
15	public.time_bucket(interval,timestamp with time zone)	7 days	\N	\N	\N	t
17	public.time_bucket(interval,timestamp with time zone)	01:00:00	\N	\N	\N	t
18	public.time_bucket(interval,timestamp with time zone)	1 day	\N	\N	\N	t
23	public.time_bucket(interval,pg_catalog.date)	1 day	\N	\N	\N	t
\.


--
-- Data for Name: continuous_aggs_hypertable_invalidation_log; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

COPY _timescaledb_catalog.continuous_aggs_hypertable_invalidation_log (hypertable_id, lowest_modified_value, greatest_modified_value) FROM stdin;
\.


--
-- Data for Name: continuous_aggs_invalidation_threshold; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

COPY _timescaledb_catalog.continuous_aggs_invalidation_threshold (hypertable_id, watermark) FROM stdin;
12	1767657600000000
5	1767830400000000
22	1767830400000000
16	1767855600000000
\.


--
-- Data for Name: continuous_aggs_materialization_invalidation_log; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

COPY _timescaledb_catalog.continuous_aggs_materialization_invalidation_log (materialization_id, lowest_modified_value, greatest_modified_value) FROM stdin;
8	-9223372036854775808	9223372036854775807
17	1767308400000000	1767333599999999
8	1765756800000000	1766966399999999
7	-9223372036854775808	1766534399999999
15	-9223372036854775808	9223372036854775807
14	-9223372036854775808	1766620799999999
17	-9223372036854775808	1766854799999999
18	-9223372036854775808	1766275199999999
17	1767117600000000	1767160799999999
17	1766869200000000	1766897999999999
17	1766908800000000	1766912399999999
23	-9223372036854775808	1764287999999999
17	1767384000000000	1767391199999999
17	1767394800000000	1767427199999999
17	1766948400000000	1766955599999999
17	1766959200000000	1766995199999999
17	1767207600000000	1767218399999999
17	1767031200000000	1767041999999999
17	1767045600000000	1767070799999999
17	1767222000000000	1767250799999999
17	1767470400000000	1767517199999999
17	1767520800000000	1767531599999999
17	1767297600000000	1767304799999999
17	1767549600000000	1767603599999999
17	1767621600000000	1767632399999999
17	1767636000000000	1767675599999999
17	1767726000000000	1767769199999999
14	1767657600000000	9223372036854775807
17	1767790800000000	1767797999999999
17	1767819600000000	1767848399999999
23	1767830400000000	9223372036854775807
18	1767830400000000	9223372036854775807
7	1767830400000000	9223372036854775807
17	1767855600000000	9223372036854775807
\.


--
-- Data for Name: continuous_aggs_materialization_ranges; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

COPY _timescaledb_catalog.continuous_aggs_materialization_ranges (materialization_id, lowest_modified_value, greatest_modified_value) FROM stdin;
\.


--
-- Data for Name: continuous_aggs_watermark; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

COPY _timescaledb_catalog.continuous_aggs_watermark (mat_hypertable_id, watermark) FROM stdin;
8	-210866803200000000
7	1766793600000000
14	-210866803200000000
15	-210866803200000000
23	1767312000000000
17	1767783600000000
18	1767830400000000
\.


--
-- Data for Name: metadata; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

COPY _timescaledb_catalog.metadata (key, value, include_in_telemetry) FROM stdin;
install_timestamp	2025-12-22 07:49:37.8826+00	t
timescaledb_version	2.24.0	f
exported_uuid	560e42a9-d4b7-40a7-9c13-6dc70e98fe1c	t
\.


--
-- Data for Name: tablespace; Type: TABLE DATA; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

COPY _timescaledb_catalog.tablespace (id, hypertable_id, tablespace_name) FROM stdin;
\.


--
-- Data for Name: bgw_job; Type: TABLE DATA; Schema: _timescaledb_config; Owner: gaveurs_admin
--

COPY _timescaledb_config.bgw_job (id, application_name, schedule_interval, max_runtime, max_retries, retry_period, proc_schema, proc_name, owner, scheduled, fixed_schedule, initial_start, hypertable_id, config, check_schema, check_name, timezone) FROM stdin;
1000	Retention Policy [1000]	1 day	00:05:00	-1	00:05:00	_timescaledb_functions	policy_retention	gaveurs_admin	t	f	\N	1	{"drop_after": "2 years", "hypertable_id": 1}	_timescaledb_functions	policy_retention_check	\N
1001	Retention Policy [1001]	1 day	00:05:00	-1	00:05:00	_timescaledb_functions	policy_retention	gaveurs_admin	t	f	\N	2	{"drop_after": "1 year", "hypertable_id": 2}	_timescaledb_functions	policy_retention_check	\N
1002	Columnstore Policy [1002]	12:00:00	00:00:00	-1	01:00:00	_timescaledb_functions	policy_compression	gaveurs_admin	t	f	\N	1	{"hypertable_id": 1, "compress_after": "7 days"}	_timescaledb_functions	policy_compression_check	\N
1003	Columnstore Policy [1003]	12:00:00	00:00:00	-1	01:00:00	_timescaledb_functions	policy_compression	gaveurs_admin	t	f	\N	2	{"hypertable_id": 2, "compress_after": "30 days"}	_timescaledb_functions	policy_compression_check	\N
1004	Columnstore Policy [1004]	12:00:00	00:00:00	-1	01:00:00	_timescaledb_functions	policy_compression	gaveurs_admin	t	f	\N	5	{"hypertable_id": 5, "compress_after": "7 days"}	_timescaledb_functions	policy_compression_check	\N
1005	Retention Policy [1005]	1 day	00:05:00	-1	00:05:00	_timescaledb_functions	policy_retention	gaveurs_admin	t	f	\N	5	{"drop_after": "2 years", "hypertable_id": 5}	_timescaledb_functions	policy_retention_check	\N
1006	Refresh Continuous Aggregate Policy [1006]	01:00:00	00:00:00	-1	01:00:00	_timescaledb_functions	policy_refresh_continuous_aggregate	gaveurs_admin	t	f	\N	7	{"end_offset": "01:00:00", "start_offset": "3 days", "mat_hypertable_id": 7}	_timescaledb_functions	policy_refresh_continuous_aggregate_check	\N
1007	Retention Policy [1007]	1 day	00:05:00	-1	00:05:00	_timescaledb_functions	policy_retention	gaveurs_admin	t	f	\N	9	{"drop_after": "6 mons", "hypertable_id": 9}	_timescaledb_functions	policy_retention_check	\N
1008	Columnstore Policy [1008]	12:00:00	00:00:00	-1	01:00:00	_timescaledb_functions	policy_compression	gaveurs_admin	t	f	\N	9	{"hypertable_id": 9, "compress_after": "7 days"}	_timescaledb_functions	policy_compression_check	\N
1009	Columnstore Policy [1009]	12:00:00	00:00:00	-1	01:00:00	_timescaledb_functions	policy_compression	gaveurs_admin	t	f	\N	12	{"hypertable_id": 12, "compress_after": "30 days"}	_timescaledb_functions	policy_compression_check	\N
1010	Retention Policy [1010]	1 day	00:05:00	-1	00:05:00	_timescaledb_functions	policy_retention	gaveurs_admin	t	f	\N	12	{"drop_after": "5 years", "hypertable_id": 12}	_timescaledb_functions	policy_retention_check	\N
1011	Refresh Continuous Aggregate Policy [1011]	1 day	00:00:00	-1	1 day	_timescaledb_functions	policy_refresh_continuous_aggregate	gaveurs_admin	t	f	\N	14	{"end_offset": "1 day", "start_offset": "3 days", "mat_hypertable_id": 14}	_timescaledb_functions	policy_refresh_continuous_aggregate_check	\N
1012	Refresh Continuous Aggregate Policy [1012]	01:00:00	00:00:00	-1	01:00:00	_timescaledb_functions	policy_refresh_continuous_aggregate	gaveurs_admin	t	f	\N	17	{"end_offset": "01:00:00", "start_offset": "03:00:00", "mat_hypertable_id": 17}	_timescaledb_functions	policy_refresh_continuous_aggregate_check	\N
1013	Refresh Continuous Aggregate Policy [1013]	06:00:00	00:00:00	-1	06:00:00	_timescaledb_functions	policy_refresh_continuous_aggregate	gaveurs_admin	t	f	\N	18	{"end_offset": "01:00:00", "start_offset": "7 days", "mat_hypertable_id": 18}	_timescaledb_functions	policy_refresh_continuous_aggregate_check	\N
1014	Retention Policy [1014]	1 day	00:05:00	-1	00:05:00	_timescaledb_functions	policy_retention	gaveurs_admin	t	f	\N	16	{"drop_after": "90 days", "hypertable_id": 16}	_timescaledb_functions	policy_retention_check	\N
1015	Retention Policy [1015]	1 day	00:05:00	-1	00:05:00	_timescaledb_functions	policy_retention	gaveurs_admin	t	f	\N	19	{"drop_after": "180 days", "hypertable_id": 19}	_timescaledb_functions	policy_retention_check	\N
1016	Columnstore Policy [1016]	12:00:00	00:00:00	-1	01:00:00	_timescaledb_functions	policy_compression	gaveurs_admin	t	f	\N	16	{"hypertable_id": 16, "compress_after": "7 days"}	_timescaledb_functions	policy_compression_check	\N
1017	Columnstore Policy [1017]	12:00:00	00:00:00	-1	01:00:00	_timescaledb_functions	policy_compression	gaveurs_admin	t	f	\N	19	{"hypertable_id": 19, "compress_after": "30 days"}	_timescaledb_functions	policy_compression_check	\N
1018	Refresh Continuous Aggregate Policy [1018]	01:00:00	00:00:00	-1	01:00:00	_timescaledb_functions	policy_refresh_continuous_aggregate	gaveurs_admin	t	f	\N	23	{"end_offset": "01:00:00", "start_offset": "30 days", "mat_hypertable_id": 23}	_timescaledb_functions	policy_refresh_continuous_aggregate_check	\N
\.


--
-- Data for Name: _compressed_hypertable_11; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._compressed_hypertable_11  FROM stdin;
\.


--
-- Data for Name: _compressed_hypertable_13; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._compressed_hypertable_13  FROM stdin;
\.


--
-- Data for Name: _compressed_hypertable_20; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._compressed_hypertable_20  FROM stdin;
\.


--
-- Data for Name: _compressed_hypertable_21; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._compressed_hypertable_21  FROM stdin;
\.


--
-- Data for Name: _compressed_hypertable_3; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._compressed_hypertable_3  FROM stdin;
\.


--
-- Data for Name: _compressed_hypertable_4; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._compressed_hypertable_4  FROM stdin;
\.


--
-- Data for Name: _compressed_hypertable_6; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._compressed_hypertable_6  FROM stdin;
\.


--
-- Data for Name: _hyper_16_27_chunk; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._hyper_16_27_chunk ("time", sample_id, device_id, lot_id, vl53l8ch_distance_matrix, vl53l8ch_reflectance_matrix, vl53l8ch_amplitude_matrix, vl53l8ch_integration_time, vl53l8ch_temperature_c, vl53l8ch_volume_mm3, vl53l8ch_avg_height_mm, vl53l8ch_max_height_mm, vl53l8ch_min_height_mm, vl53l8ch_surface_uniformity, vl53l8ch_bins_analysis, vl53l8ch_reflectance_analysis, vl53l8ch_amplitude_consistency, vl53l8ch_quality_score, vl53l8ch_grade, vl53l8ch_score_breakdown, vl53l8ch_defects, as7341_channels, as7341_integration_time, as7341_gain, as7341_freshness_index, as7341_fat_quality_index, as7341_oxidation_index, as7341_spectral_analysis, as7341_color_analysis, as7341_quality_score, as7341_grade, as7341_score_breakdown, as7341_defects, fusion_final_score, fusion_final_grade, fusion_vl53l8ch_score, fusion_as7341_score, fusion_defects, fusion_is_compliant, meta_firmware_version, meta_temperature_c, meta_humidity_percent, meta_config_profile, created_at, poids_foie_estime_g) FROM stdin;
2026-01-02 08:57:12.920355+00	TEST-SQAL-001	ESP32-FOIEGRAS-LL-001	272	[[50, 51, 52, 53, 54, 55, 56, 57], [58, 59, 60, 61, 62, 63, 64, 65], [66, 67, 68, 69, 70, 71, 72, 73], [74, 75, 76, 77, 78, 79, 80, 81], [82, 83, 84, 85, 86, 87, 88, 89], [90, 91, 92, 93, 94, 95, 96, 97], [98, 99, 100, 101, 102, 103, 104, 105], [106, 107, 108, 109, 110, 111, 112, 113]]	[[100, 101, 102, 103, 104, 105, 106, 107], [108, 109, 110, 111, 112, 113, 114, 115], [116, 117, 118, 119, 120, 121, 122, 123], [124, 125, 126, 127, 128, 129, 130, 131], [132, 133, 134, 135, 136, 137, 138, 139], [140, 141, 142, 143, 144, 145, 146, 147], [148, 149, 150, 151, 152, 153, 154, 155], [156, 157, 158, 159, 160, 161, 162, 163]]	[[200, 201, 202, 203, 204, 205, 206, 207], [208, 209, 210, 211, 212, 213, 214, 215], [216, 217, 218, 219, 220, 221, 222, 223], [224, 225, 226, 227, 228, 229, 230, 231], [232, 233, 234, 235, 236, 237, 238, 239], [240, 241, 242, 243, 244, 245, 246, 247], [248, 249, 250, 251, 252, 253, 254, 255], [256, 257, 258, 259, 260, 261, 262, 263]]	\N	\N	678500.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"NIR": 2600, "Clear": 3000, "F1_415nm": 1000, "F2_445nm": 1200, "F3_480nm": 1400, "F4_515nm": 1600, "F5_555nm": 1800, "F6_590nm": 2000, "F7_630nm": 2200, "F8_680nm": 2400}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.8500	A	\N	\N	\N	t	\N	\N	\N	\N	2026-01-02 08:57:12.920355+00	642.50
2026-01-02 08:58:01.829735+00	TEST-SQAL-002	ESP32-FOIEGRAS-LL-001	187	[[50, 51, 52, 53, 54, 55, 56, 57], [58, 59, 60, 61, 62, 63, 64, 65], [66, 67, 68, 69, 70, 71, 72, 73], [74, 75, 76, 77, 78, 79, 80, 81], [82, 83, 84, 85, 86, 87, 88, 89], [90, 91, 92, 93, 94, 95, 96, 97], [98, 99, 100, 101, 102, 103, 104, 105], [106, 107, 108, 109, 110, 111, 112, 113]]	[[100, 101, 102, 103, 104, 105, 106, 107], [108, 109, 110, 111, 112, 113, 114, 115], [116, 117, 118, 119, 120, 121, 122, 123], [124, 125, 126, 127, 128, 129, 130, 131], [132, 133, 134, 135, 136, 137, 138, 139], [140, 141, 142, 143, 144, 145, 146, 147], [148, 149, 150, 151, 152, 153, 154, 155], [156, 157, 158, 159, 160, 161, 162, 163]]	[[200, 201, 202, 203, 204, 205, 206, 207], [208, 209, 210, 211, 212, 213, 214, 215], [216, 217, 218, 219, 220, 221, 222, 223], [224, 225, 226, 227, 228, 229, 230, 231], [232, 233, 234, 235, 236, 237, 238, 239], [240, 241, 242, 243, 244, 245, 246, 247], [248, 249, 250, 251, 252, 253, 254, 255], [256, 257, 258, 259, 260, 261, 262, 263]]	\N	\N	675418.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"NIR": 2600, "Clear": 3000, "F1_415nm": 1000, "F2_445nm": 1200, "F3_480nm": 1400, "F4_515nm": 1600, "F5_555nm": 1800, "F6_590nm": 2000, "F7_630nm": 2200, "F8_680nm": 2400}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.9374	A	\N	\N	\N	t	\N	\N	\N	\N	2026-01-02 08:58:01.829735+00	628.60
2026-01-02 08:58:01.829735+00	TEST-SQAL-003	ESP32-FOIEGRAS-LL-001	187	[[50, 51, 52, 53, 54, 55, 56, 57], [58, 59, 60, 61, 62, 63, 64, 65], [66, 67, 68, 69, 70, 71, 72, 73], [74, 75, 76, 77, 78, 79, 80, 81], [82, 83, 84, 85, 86, 87, 88, 89], [90, 91, 92, 93, 94, 95, 96, 97], [98, 99, 100, 101, 102, 103, 104, 105], [106, 107, 108, 109, 110, 111, 112, 113]]	[[100, 101, 102, 103, 104, 105, 106, 107], [108, 109, 110, 111, 112, 113, 114, 115], [116, 117, 118, 119, 120, 121, 122, 123], [124, 125, 126, 127, 128, 129, 130, 131], [132, 133, 134, 135, 136, 137, 138, 139], [140, 141, 142, 143, 144, 145, 146, 147], [148, 149, 150, 151, 152, 153, 154, 155], [156, 157, 158, 159, 160, 161, 162, 163]]	[[200, 201, 202, 203, 204, 205, 206, 207], [208, 209, 210, 211, 212, 213, 214, 215], [216, 217, 218, 219, 220, 221, 222, 223], [224, 225, 226, 227, 228, 229, 230, 231], [232, 233, 234, 235, 236, 237, 238, 239], [240, 241, 242, 243, 244, 245, 246, 247], [248, 249, 250, 251, 252, 253, 254, 255], [256, 257, 258, 259, 260, 261, 262, 263]]	\N	\N	707899.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"NIR": 2600, "Clear": 3000, "F1_415nm": 1000, "F2_445nm": 1200, "F3_480nm": 1400, "F4_515nm": 1600, "F5_555nm": 1800, "F6_590nm": 2000, "F7_630nm": 2200, "F8_680nm": 2400}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.8524	A	\N	\N	\N	t	\N	\N	\N	\N	2026-01-02 08:58:01.829735+00	680.10
2026-01-02 08:58:01.829735+00	TEST-SQAL-004	ESP32-FOIEGRAS-LL-001	187	[[50, 51, 52, 53, 54, 55, 56, 57], [58, 59, 60, 61, 62, 63, 64, 65], [66, 67, 68, 69, 70, 71, 72, 73], [74, 75, 76, 77, 78, 79, 80, 81], [82, 83, 84, 85, 86, 87, 88, 89], [90, 91, 92, 93, 94, 95, 96, 97], [98, 99, 100, 101, 102, 103, 104, 105], [106, 107, 108, 109, 110, 111, 112, 113]]	[[100, 101, 102, 103, 104, 105, 106, 107], [108, 109, 110, 111, 112, 113, 114, 115], [116, 117, 118, 119, 120, 121, 122, 123], [124, 125, 126, 127, 128, 129, 130, 131], [132, 133, 134, 135, 136, 137, 138, 139], [140, 141, 142, 143, 144, 145, 146, 147], [148, 149, 150, 151, 152, 153, 154, 155], [156, 157, 158, 159, 160, 161, 162, 163]]	[[200, 201, 202, 203, 204, 205, 206, 207], [208, 209, 210, 211, 212, 213, 214, 215], [216, 217, 218, 219, 220, 221, 222, 223], [224, 225, 226, 227, 228, 229, 230, 231], [232, 233, 234, 235, 236, 237, 238, 239], [240, 241, 242, 243, 244, 245, 246, 247], [248, 249, 250, 251, 252, 253, 254, 255], [256, 257, 258, 259, 260, 261, 262, 263]]	\N	\N	686910.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"NIR": 2600, "Clear": 3000, "F1_415nm": 1000, "F2_445nm": 1200, "F3_480nm": 1400, "F4_515nm": 1600, "F5_555nm": 1800, "F6_590nm": 2000, "F7_630nm": 2200, "F8_680nm": 2400}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.9088	A	\N	\N	\N	t	\N	\N	\N	\N	2026-01-02 08:58:01.829735+00	710.20
2026-01-02 08:58:01.829735+00	TEST-SQAL-005	ESP32-FOIEGRAS-LL-001	187	[[50, 51, 52, 53, 54, 55, 56, 57], [58, 59, 60, 61, 62, 63, 64, 65], [66, 67, 68, 69, 70, 71, 72, 73], [74, 75, 76, 77, 78, 79, 80, 81], [82, 83, 84, 85, 86, 87, 88, 89], [90, 91, 92, 93, 94, 95, 96, 97], [98, 99, 100, 101, 102, 103, 104, 105], [106, 107, 108, 109, 110, 111, 112, 113]]	[[100, 101, 102, 103, 104, 105, 106, 107], [108, 109, 110, 111, 112, 113, 114, 115], [116, 117, 118, 119, 120, 121, 122, 123], [124, 125, 126, 127, 128, 129, 130, 131], [132, 133, 134, 135, 136, 137, 138, 139], [140, 141, 142, 143, 144, 145, 146, 147], [148, 149, 150, 151, 152, 153, 154, 155], [156, 157, 158, 159, 160, 161, 162, 163]]	[[200, 201, 202, 203, 204, 205, 206, 207], [208, 209, 210, 211, 212, 213, 214, 215], [216, 217, 218, 219, 220, 221, 222, 223], [224, 225, 226, 227, 228, 229, 230, 231], [232, 233, 234, 235, 236, 237, 238, 239], [240, 241, 242, 243, 244, 245, 246, 247], [248, 249, 250, 251, 252, 253, 254, 255], [256, 257, 258, 259, 260, 261, 262, 263]]	\N	\N	689037.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"NIR": 2600, "Clear": 3000, "F1_415nm": 1000, "F2_445nm": 1200, "F3_480nm": 1400, "F4_515nm": 1600, "F5_555nm": 1800, "F6_590nm": 2000, "F7_630nm": 2200, "F8_680nm": 2400}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.8251	A	\N	\N	\N	t	\N	\N	\N	\N	2026-01-02 08:58:01.829735+00	679.30
2026-01-02 08:58:01.829735+00	TEST-SQAL-006	ESP32-FOIEGRAS-LL-001	187	[[50, 51, 52, 53, 54, 55, 56, 57], [58, 59, 60, 61, 62, 63, 64, 65], [66, 67, 68, 69, 70, 71, 72, 73], [74, 75, 76, 77, 78, 79, 80, 81], [82, 83, 84, 85, 86, 87, 88, 89], [90, 91, 92, 93, 94, 95, 96, 97], [98, 99, 100, 101, 102, 103, 104, 105], [106, 107, 108, 109, 110, 111, 112, 113]]	[[100, 101, 102, 103, 104, 105, 106, 107], [108, 109, 110, 111, 112, 113, 114, 115], [116, 117, 118, 119, 120, 121, 122, 123], [124, 125, 126, 127, 128, 129, 130, 131], [132, 133, 134, 135, 136, 137, 138, 139], [140, 141, 142, 143, 144, 145, 146, 147], [148, 149, 150, 151, 152, 153, 154, 155], [156, 157, 158, 159, 160, 161, 162, 163]]	[[200, 201, 202, 203, 204, 205, 206, 207], [208, 209, 210, 211, 212, 213, 214, 215], [216, 217, 218, 219, 220, 221, 222, 223], [224, 225, 226, 227, 228, 229, 230, 231], [232, 233, 234, 235, 236, 237, 238, 239], [240, 241, 242, 243, 244, 245, 246, 247], [248, 249, 250, 251, 252, 253, 254, 255], [256, 257, 258, 259, 260, 261, 262, 263]]	\N	\N	654057.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"NIR": 2600, "Clear": 3000, "F1_415nm": 1000, "F2_445nm": 1200, "F3_480nm": 1400, "F4_515nm": 1600, "F5_555nm": 1800, "F6_590nm": 2000, "F7_630nm": 2200, "F8_680nm": 2400}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.8084	A	\N	\N	\N	t	\N	\N	\N	\N	2026-01-02 08:58:01.829735+00	666.50
2026-01-02 08:58:01.829735+00	TEST-SQAL-007	ESP32-FOIEGRAS-LL-001	187	[[50, 51, 52, 53, 54, 55, 56, 57], [58, 59, 60, 61, 62, 63, 64, 65], [66, 67, 68, 69, 70, 71, 72, 73], [74, 75, 76, 77, 78, 79, 80, 81], [82, 83, 84, 85, 86, 87, 88, 89], [90, 91, 92, 93, 94, 95, 96, 97], [98, 99, 100, 101, 102, 103, 104, 105], [106, 107, 108, 109, 110, 111, 112, 113]]	[[100, 101, 102, 103, 104, 105, 106, 107], [108, 109, 110, 111, 112, 113, 114, 115], [116, 117, 118, 119, 120, 121, 122, 123], [124, 125, 126, 127, 128, 129, 130, 131], [132, 133, 134, 135, 136, 137, 138, 139], [140, 141, 142, 143, 144, 145, 146, 147], [148, 149, 150, 151, 152, 153, 154, 155], [156, 157, 158, 159, 160, 161, 162, 163]]	[[200, 201, 202, 203, 204, 205, 206, 207], [208, 209, 210, 211, 212, 213, 214, 215], [216, 217, 218, 219, 220, 221, 222, 223], [224, 225, 226, 227, 228, 229, 230, 231], [232, 233, 234, 235, 236, 237, 238, 239], [240, 241, 242, 243, 244, 245, 246, 247], [248, 249, 250, 251, 252, 253, 254, 255], [256, 257, 258, 259, 260, 261, 262, 263]]	\N	\N	697320.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"NIR": 2600, "Clear": 3000, "F1_415nm": 1000, "F2_445nm": 1200, "F3_480nm": 1400, "F4_515nm": 1600, "F5_555nm": 1800, "F6_590nm": 2000, "F7_630nm": 2200, "F8_680nm": 2400}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.8063	A	\N	\N	\N	t	\N	\N	\N	\N	2026-01-02 08:58:01.829735+00	630.50
2026-01-02 08:58:01.829735+00	TEST-SQAL-008	ESP32-FOIEGRAS-LL-001	187	[[50, 51, 52, 53, 54, 55, 56, 57], [58, 59, 60, 61, 62, 63, 64, 65], [66, 67, 68, 69, 70, 71, 72, 73], [74, 75, 76, 77, 78, 79, 80, 81], [82, 83, 84, 85, 86, 87, 88, 89], [90, 91, 92, 93, 94, 95, 96, 97], [98, 99, 100, 101, 102, 103, 104, 105], [106, 107, 108, 109, 110, 111, 112, 113]]	[[100, 101, 102, 103, 104, 105, 106, 107], [108, 109, 110, 111, 112, 113, 114, 115], [116, 117, 118, 119, 120, 121, 122, 123], [124, 125, 126, 127, 128, 129, 130, 131], [132, 133, 134, 135, 136, 137, 138, 139], [140, 141, 142, 143, 144, 145, 146, 147], [148, 149, 150, 151, 152, 153, 154, 155], [156, 157, 158, 159, 160, 161, 162, 163]]	[[200, 201, 202, 203, 204, 205, 206, 207], [208, 209, 210, 211, 212, 213, 214, 215], [216, 217, 218, 219, 220, 221, 222, 223], [224, 225, 226, 227, 228, 229, 230, 231], [232, 233, 234, 235, 236, 237, 238, 239], [240, 241, 242, 243, 244, 245, 246, 247], [248, 249, 250, 251, 252, 253, 254, 255], [256, 257, 258, 259, 260, 261, 262, 263]]	\N	\N	685299.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"NIR": 2600, "Clear": 3000, "F1_415nm": 1000, "F2_445nm": 1200, "F3_480nm": 1400, "F4_515nm": 1600, "F5_555nm": 1800, "F6_590nm": 2000, "F7_630nm": 2200, "F8_680nm": 2400}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.8953	A	\N	\N	\N	t	\N	\N	\N	\N	2026-01-02 08:58:01.829735+00	638.90
2026-01-02 08:58:01.829735+00	TEST-SQAL-009	ESP32-FOIEGRAS-LL-001	187	[[50, 51, 52, 53, 54, 55, 56, 57], [58, 59, 60, 61, 62, 63, 64, 65], [66, 67, 68, 69, 70, 71, 72, 73], [74, 75, 76, 77, 78, 79, 80, 81], [82, 83, 84, 85, 86, 87, 88, 89], [90, 91, 92, 93, 94, 95, 96, 97], [98, 99, 100, 101, 102, 103, 104, 105], [106, 107, 108, 109, 110, 111, 112, 113]]	[[100, 101, 102, 103, 104, 105, 106, 107], [108, 109, 110, 111, 112, 113, 114, 115], [116, 117, 118, 119, 120, 121, 122, 123], [124, 125, 126, 127, 128, 129, 130, 131], [132, 133, 134, 135, 136, 137, 138, 139], [140, 141, 142, 143, 144, 145, 146, 147], [148, 149, 150, 151, 152, 153, 154, 155], [156, 157, 158, 159, 160, 161, 162, 163]]	[[200, 201, 202, 203, 204, 205, 206, 207], [208, 209, 210, 211, 212, 213, 214, 215], [216, 217, 218, 219, 220, 221, 222, 223], [224, 225, 226, 227, 228, 229, 230, 231], [232, 233, 234, 235, 236, 237, 238, 239], [240, 241, 242, 243, 244, 245, 246, 247], [248, 249, 250, 251, 252, 253, 254, 255], [256, 257, 258, 259, 260, 261, 262, 263]]	\N	\N	743061.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"NIR": 2600, "Clear": 3000, "F1_415nm": 1000, "F2_445nm": 1200, "F3_480nm": 1400, "F4_515nm": 1600, "F5_555nm": 1800, "F6_590nm": 2000, "F7_630nm": 2200, "F8_680nm": 2400}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.8858	A	\N	\N	\N	t	\N	\N	\N	\N	2026-01-02 08:58:01.829735+00	661.40
2026-01-02 08:58:01.829735+00	TEST-SQAL-010	ESP32-FOIEGRAS-LL-001	187	[[50, 51, 52, 53, 54, 55, 56, 57], [58, 59, 60, 61, 62, 63, 64, 65], [66, 67, 68, 69, 70, 71, 72, 73], [74, 75, 76, 77, 78, 79, 80, 81], [82, 83, 84, 85, 86, 87, 88, 89], [90, 91, 92, 93, 94, 95, 96, 97], [98, 99, 100, 101, 102, 103, 104, 105], [106, 107, 108, 109, 110, 111, 112, 113]]	[[100, 101, 102, 103, 104, 105, 106, 107], [108, 109, 110, 111, 112, 113, 114, 115], [116, 117, 118, 119, 120, 121, 122, 123], [124, 125, 126, 127, 128, 129, 130, 131], [132, 133, 134, 135, 136, 137, 138, 139], [140, 141, 142, 143, 144, 145, 146, 147], [148, 149, 150, 151, 152, 153, 154, 155], [156, 157, 158, 159, 160, 161, 162, 163]]	[[200, 201, 202, 203, 204, 205, 206, 207], [208, 209, 210, 211, 212, 213, 214, 215], [216, 217, 218, 219, 220, 221, 222, 223], [224, 225, 226, 227, 228, 229, 230, 231], [232, 233, 234, 235, 236, 237, 238, 239], [240, 241, 242, 243, 244, 245, 246, 247], [248, 249, 250, 251, 252, 253, 254, 255], [256, 257, 258, 259, 260, 261, 262, 263]]	\N	\N	739674.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"NIR": 2600, "Clear": 3000, "F1_415nm": 1000, "F2_445nm": 1200, "F3_480nm": 1400, "F4_515nm": 1600, "F5_555nm": 1800, "F6_590nm": 2000, "F7_630nm": 2200, "F8_680nm": 2400}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.9274	A	\N	\N	\N	t	\N	\N	\N	\N	2026-01-02 08:58:01.829735+00	674.20
2026-01-02 08:58:01.829735+00	TEST-SQAL-011	ESP32-FOIEGRAS-LL-001	187	[[50, 51, 52, 53, 54, 55, 56, 57], [58, 59, 60, 61, 62, 63, 64, 65], [66, 67, 68, 69, 70, 71, 72, 73], [74, 75, 76, 77, 78, 79, 80, 81], [82, 83, 84, 85, 86, 87, 88, 89], [90, 91, 92, 93, 94, 95, 96, 97], [98, 99, 100, 101, 102, 103, 104, 105], [106, 107, 108, 109, 110, 111, 112, 113]]	[[100, 101, 102, 103, 104, 105, 106, 107], [108, 109, 110, 111, 112, 113, 114, 115], [116, 117, 118, 119, 120, 121, 122, 123], [124, 125, 126, 127, 128, 129, 130, 131], [132, 133, 134, 135, 136, 137, 138, 139], [140, 141, 142, 143, 144, 145, 146, 147], [148, 149, 150, 151, 152, 153, 154, 155], [156, 157, 158, 159, 160, 161, 162, 163]]	[[200, 201, 202, 203, 204, 205, 206, 207], [208, 209, 210, 211, 212, 213, 214, 215], [216, 217, 218, 219, 220, 221, 222, 223], [224, 225, 226, 227, 228, 229, 230, 231], [232, 233, 234, 235, 236, 237, 238, 239], [240, 241, 242, 243, 244, 245, 246, 247], [248, 249, 250, 251, 252, 253, 254, 255], [256, 257, 258, 259, 260, 261, 262, 263]]	\N	\N	726704.00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{"NIR": 2600, "Clear": 3000, "F1_415nm": 1000, "F2_445nm": 1200, "F3_480nm": 1400, "F4_515nm": 1600, "F5_555nm": 1800, "F6_590nm": 2000, "F7_630nm": 2200, "F8_680nm": 2400}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	0.8327	A	\N	\N	\N	t	\N	\N	\N	\N	2026-01-02 08:58:01.829735+00	633.70
2026-01-06 12:00:00+00	TEST-001	TEST	\N	[[100, 100, 100, 100, 100, 100, 100, 100], [100, 100, 100, 100, 100, 100, 100, 100], [100, 100, 100, 100, 100, 100, 100, 100], [100, 100, 100, 100, 100, 100, 100, 100], [100, 100, 100, 100, 100, 100, 100, 100], [100, 100, 100, 100, 100, 100, 100, 100], [100, 100, 100, 100, 100, 100, 100, 100], [100, 100, 100, 100, 100, 100, 100, 100]]	[[150, 150, 150, 150, 150, 150, 150, 150], [150, 150, 150, 150, 150, 150, 150, 150], [150, 150, 150, 150, 150, 150, 150, 150], [150, 150, 150, 150, 150, 150, 150, 150], [150, 150, 150, 150, 150, 150, 150, 150], [150, 150, 150, 150, 150, 150, 150, 150], [150, 150, 150, 150, 150, 150, 150, 150], [150, 150, 150, 150, 150, 150, 150, 150]]	[[100, 100, 100, 100, 100, 100, 100, 100], [100, 100, 100, 100, 100, 100, 100, 100], [100, 100, 100, 100, 100, 100, 100, 100], [100, 100, 100, 100, 100, 100, 100, 100], [100, 100, 100, 100, 100, 100, 100, 100], [100, 100, 100, 100, 100, 100, 100, 100], [100, 100, 100, 100, 100, 100, 100, 100], [100, 100, 100, 100, 100, 100, 100, 100]]	\N	\N	500000.00	\N	\N	\N	0.9000	\N	\N	\N	0.8500	A+	\N	\N	{"NIR": 800, "Clear": 5000, "F1_415nm": 1000, "F2_445nm": 1200, "F3_480nm": 1500, "F4_515nm": 1800, "F5_555nm": 2000, "F6_590nm": 1700, "F7_630nm": 1400, "F8_680nm": 1100}	\N	\N	0.9000	0.8500	0.0500	\N	\N	0.8800	\N	\N	\N	0.8600	A+	\N	\N	\N	t	\N	\N	\N	\N	2026-01-06 13:30:29.438257+00	\N
2026-01-06 13:36:45.411618+00	LL-260106-9410-171	ESP32_DEMO_01	\N	[[95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 35, 67, 94, 95], [95, 95, 95, 33, 18, 80, 90, 95], [95, 95, 95, 25, 34, 90, 94, 95], [95, 98, 77, 37, 95, 95, 95, 95], [95, 100, 100, 100, 95, 95, 95, 95], [95, 98, 100, 98, 95, 95, 95, 95]]	[[71, 65, 67, 64, 65, 71, 66, 68], [69, 68, 62, 66, 67, 63, 70, 64], [67, 68, 73, 71, 54, 52, 67, 67], [71, 69, 68, 52, 48, 68, 66, 67], [75, 70, 69, 56, 54, 69, 59, 67], [70, 72, 53, 60, 71, 67, 67, 66], [70, 65, 70, 68, 67, 70, 70, 66], [69, 68, 69, 72, 73, 67, 70, 65]]	[[255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255]]	\N	\N	957656.77	\N	\N	\N	0.8500	\N	\N	\N	0.1240	REJECT	\N	\N	{"NIR": 800, "Clear": 5000, "F1_415nm": 1415, "F2_445nm": 2189, "F3_480nm": 1961, "F4_515nm": 7972, "F5_555nm": 3592, "F6_590nm": 2389, "F7_630nm": 3939, "F8_680nm": 2559}	\N	\N	1.0000	1.0000	0.0000	\N	\N	1.0000	\N	\N	\N	0.7605	A	\N	\N	\N	t	\N	\N	\N	\N	2026-01-06 13:36:45.416646+00	\N
2026-01-06 13:36:50.154103+00	LL-260106-2756-188	ESP32_DEMO_01	\N	[[95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 41, 55, 94, 95], [95, 95, 95, 31, 17, 46, 90, 95], [95, 95, 61, 25, 32, 90, 94, 95], [95, 98, 70, 47, 95, 95, 95, 95], [95, 100, 100, 100, 95, 95, 95, 95], [95, 98, 100, 98, 95, 95, 95, 95]]	[[66, 69, 66, 69, 69, 71, 68, 73], [67, 70, 68, 71, 67, 67, 66, 69], [71, 68, 70, 70, 57, 61, 69, 70], [69, 72, 68, 61, 59, 64, 68, 69], [72, 67, 61, 57, 57, 73, 64, 70], [73, 64, 59, 64, 62, 69, 69, 69], [73, 67, 65, 69, 74, 68, 73, 73], [67, 66, 68, 62, 68, 63, 69, 68]]	[[255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255]]	\N	\N	1067306.70	\N	\N	\N	0.8500	\N	\N	\N	0.0588	REJECT	\N	\N	{"NIR": 800, "Clear": 5000, "F1_415nm": 1454, "F2_445nm": 2236, "F3_480nm": 1993, "F4_515nm": 7908, "F5_555nm": 3599, "F6_590nm": 2405, "F7_630nm": 4082, "F8_680nm": 2647}	\N	\N	1.0000	1.0000	0.0000	\N	\N	1.0000	\N	\N	\N	0.7622	A	\N	\N	\N	t	\N	\N	\N	\N	2026-01-06 13:36:50.159577+00	\N
2026-01-06 13:36:55.243364+00	LL-260106-5558-163	ESP32_DEMO_01	\N	[[95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 39, 55, 94, 95], [95, 95, 95, 31, 17, 49, 90, 95], [95, 95, 65, 25, 33, 90, 94, 95], [95, 98, 70, 46, 95, 95, 95, 95], [95, 100, 100, 100, 95, 95, 95, 95], [95, 98, 100, 98, 95, 95, 95, 95]]	[[74, 73, 72, 74, 67, 72, 70, 75], [74, 72, 72, 80, 76, 75, 73, 71], [71, 71, 77, 76, 56, 59, 70, 69], [80, 70, 69, 50, 58, 54, 73, 78], [70, 73, 61, 53, 57, 73, 73, 74], [75, 75, 61, 57, 69, 73, 70, 71], [71, 77, 70, 73, 72, 70, 77, 71], [70, 76, 78, 68, 72, 73, 70, 76]]	[[255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255]]	\N	\N	1059513.26	\N	\N	\N	0.8500	\N	\N	\N	0.0658	REJECT	\N	\N	{"NIR": 800, "Clear": 5000, "F1_415nm": 1092, "F2_445nm": 1845, "F3_480nm": 1845, "F4_515nm": 8619, "F5_555nm": 3814, "F6_590nm": 2161, "F7_630nm": 2898, "F8_680nm": 1818}	\N	\N	1.0000	0.5699	0.4301	\N	\N	0.3664	\N	\N	\N	0.5052	C	\N	\N	\N	t	\N	\N	\N	\N	2026-01-06 13:36:55.248381+00	\N
2026-01-06 13:37:00.349377+00	MG-260106-2959-050	ESP32_DEMO_01	\N	[[95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 56, 95, 95, 95], [95, 95, 95, 71, 33, 90, 94, 95], [95, 95, 95, 36, 21, 80, 90, 95], [95, 95, 95, 27, 34, 90, 94, 95], [95, 98, 100, 32, 67, 95, 95, 95], [95, 100, 100, 61, 95, 95, 95, 95], [95, 98, 100, 98, 95, 95, 95, 95]]	[[73, 66, 67, 67, 71, 69, 68, 69], [64, 68, 67, 72, 51, 68, 72, 72], [69, 65, 68, 60, 64, 67, 64, 68], [73, 72, 66, 58, 55, 72, 65, 70], [69, 70, 67, 60, 52, 69, 71, 68], [67, 68, 71, 48, 53, 74, 73, 72], [67, 69, 63, 54, 76, 69, 74, 69], [70, 69, 65, 66, 67, 72, 67, 67]]	[[255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255]]	\N	\N	1075018.44	\N	\N	\N	0.8500	\N	\N	\N	0.1185	REJECT	\N	\N	{"NIR": 800, "Clear": 5000, "F1_415nm": 1100, "F2_445nm": 1858, "F3_480nm": 1941, "F4_515nm": 8801, "F5_555nm": 3643, "F6_590nm": 2337, "F7_630nm": 2924, "F8_680nm": 1829}	\N	\N	1.0000	0.5800	0.4200	\N	\N	0.3710	\N	\N	\N	0.5135	C	\N	\N	\N	t	\N	\N	\N	\N	2026-01-06 13:37:00.356016+00	\N
2026-01-06 13:37:05.458532+00	MG-260106-5042-162	ESP32_DEMO_01	\N	[[95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 36, 66, 94, 95], [95, 95, 95, 33, 17, 80, 90, 95], [95, 95, 95, 25, 35, 90, 94, 95], [95, 98, 76, 39, 95, 95, 95, 95], [95, 100, 100, 100, 95, 95, 95, 95], [95, 98, 100, 98, 95, 95, 95, 95]]	[[76, 71, 71, 75, 73, 63, 72, 70], [71, 70, 73, 65, 71, 70, 70, 75], [76, 70, 68, 72, 60, 58, 72, 68], [67, 70, 77, 56, 54, 80, 68, 72], [70, 71, 70, 59, 57, 71, 76, 71], [74, 70, 64, 63, 67, 69, 63, 76], [72, 68, 76, 69, 72, 75, 76, 73], [73, 70, 74, 71, 72, 76, 73, 75]]	[[255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255]]	\N	\N	959428.20	\N	\N	\N	0.8500	\N	\N	\N	0.1200	REJECT	\N	\N	{"NIR": 800, "Clear": 5000, "F1_415nm": 1447, "F2_445nm": 2227, "F3_480nm": 1917, "F4_515nm": 7810, "F5_555nm": 3717, "F6_590nm": 2304, "F7_630nm": 4123, "F8_680nm": 2636}	\N	\N	1.0000	1.0000	0.0000	\N	\N	1.0000	\N	\N	\N	0.7677	A	\N	\N	\N	t	\N	\N	\N	\N	2026-01-06 13:37:05.462858+00	\N
2026-01-06 13:37:10.467821+00	LL-260106-6599-129	ESP32_DEMO_01	\N	[[95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 58, 95, 95, 95], [95, 95, 95, 73, 33, 90, 94, 95], [95, 95, 95, 36, 20, 80, 90, 95], [95, 95, 95, 27, 34, 90, 94, 95], [95, 98, 100, 32, 70, 95, 95, 95], [95, 100, 100, 63, 95, 95, 95, 95], [95, 98, 100, 98, 95, 95, 95, 95]]	[[73, 70, 70, 73, 73, 71, 66, 76], [69, 67, 74, 73, 38, 73, 72, 72], [72, 64, 71, 57, 54, 67, 69, 67], [72, 71, 76, 51, 47, 71, 72, 70], [71, 72, 69, 42, 49, 69, 69, 68], [73, 73, 72, 50, 56, 74, 71, 73], [73, 69, 71, 49, 72, 69, 70, 73], [73, 70, 63, 74, 71, 70, 74, 65]]	[[255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255]]	\N	\N	1064647.63	\N	\N	\N	0.8500	\N	\N	\N	0.1298	REJECT	\N	\N	{"NIR": 800, "Clear": 5000, "F1_415nm": 1094, "F2_445nm": 1847, "F3_480nm": 1890, "F4_515nm": 8676, "F5_555nm": 3706, "F6_590nm": 2212, "F7_630nm": 2877, "F8_680nm": 1826}	\N	\N	1.0000	0.5800	0.4200	\N	\N	0.3710	\N	\N	\N	0.5105	C	\N	\N	\N	t	\N	\N	\N	\N	2026-01-06 13:37:10.473086+00	\N
2026-01-07 10:19:03.771706+00	LL-260107-4095-056	ESP32_DEMO_01	\N	[[95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 70, 95, 95, 95], [95, 95, 95, 85, 33, 90, 94, 95], [95, 95, 95, 34, 19, 80, 90, 95], [95, 95, 95, 26, 35, 90, 94, 95], [95, 98, 100, 34, 82, 95, 95, 95], [95, 100, 100, 75, 95, 95, 95, 95], [95, 98, 100, 98, 95, 95, 95, 95]]	[[72, 77, 71, 70, 74, 70, 75, 73], [72, 71, 72, 65, 52, 73, 73, 69], [75, 73, 72, 47, 60, 71, 75, 76], [71, 73, 74, 49, 48, 71, 77, 73], [70, 72, 73, 45, 57, 75, 69, 68], [67, 71, 73, 54, 50, 69, 73, 76], [69, 71, 69, 54, 76, 73, 67, 77], [72, 68, 71, 69, 73, 74, 74, 70]]	[[255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255]]	\N	\N	998284.54	\N	\N	\N	0.8500	\N	\N	\N	0.1909	REJECT	\N	\N	{"NIR": 800, "Clear": 5000, "F1_415nm": 1549, "F2_445nm": 2348, "F3_480nm": 1965, "F4_515nm": 7594, "F5_555nm": 3622, "F6_590nm": 2301, "F7_630nm": 4367, "F8_680nm": 2897}	\N	\N	1.0000	1.0000	0.0000	\N	\N	1.0000	\N	\N	\N	0.7921	A	\N	\N	\N	t	\N	\N	\N	\N	2026-01-07 10:19:03.77396+00	\N
2026-01-07 10:19:23.806096+00	MG-260107-2605-049	ESP32_DEMO_01	\N	[[95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 79, 95, 95, 95], [95, 95, 95, 93, 34, 87, 94, 95], [95, 95, 95, 34, 18, 80, 90, 95], [95, 95, 95, 26, 35, 90, 94, 95], [95, 98, 94, 35, 91, 95, 95, 95], [95, 100, 100, 84, 95, 95, 95, 95], [95, 98, 100, 98, 95, 95, 95, 95]]	[[66, 68, 63, 71, 61, 64, 68, 66], [71, 65, 68, 64, 69, 67, 65, 68], [66, 69, 63, 63, 65, 53, 67, 67], [60, 67, 63, 55, 63, 71, 66, 62], [63, 64, 63, 68, 57, 67, 58, 66], [62, 64, 65, 59, 56, 70, 66, 68], [68, 62, 64, 61, 62, 70, 62, 65], [65, 67, 61, 59, 67, 57, 64, 66]]	[[255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255]]	\N	\N	962672.82	\N	\N	\N	0.8500	\N	\N	\N	0.1527	REJECT	\N	\N	{"NIR": 800, "Clear": 5000, "F1_415nm": 1255, "F2_445nm": 2008, "F3_480nm": 1910, "F4_515nm": 8255, "F5_555nm": 3712, "F6_590nm": 2293, "F7_630nm": 3438, "F8_680nm": 2176}	\N	\N	1.0000	0.5800	0.4200	\N	\N	0.5829	\N	\N	\N	0.5939	C	\N	\N	\N	t	\N	\N	\N	\N	2026-01-07 10:19:23.808304+00	\N
2026-01-07 10:19:43.737842+00	MG-260107-4707-120	ESP32_DEMO_01	\N	[[95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 38, 56, 94, 95], [95, 95, 95, 32, 17, 57, 90, 95], [95, 95, 73, 25, 34, 90, 94, 95], [95, 98, 70, 42, 95, 95, 95, 95], [95, 100, 100, 100, 95, 95, 95, 95], [95, 98, 100, 98, 95, 95, 95, 95]]	[[69, 69, 67, 55, 64, 59, 65, 70], [62, 67, 72, 73, 68, 66, 67, 66], [66, 67, 69, 71, 56, 58, 67, 61], [62, 64, 64, 60, 55, 59, 70, 71], [69, 64, 51, 58, 57, 63, 68, 65], [67, 68, 58, 54, 65, 62, 62, 73], [69, 67, 69, 71, 66, 62, 71, 64], [68, 68, 69, 68, 64, 65, 62, 67]]	[[255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255]]	\N	\N	1040101.31	\N	\N	\N	0.8500	\N	\N	\N	0.0890	REJECT	\N	\N	{"NIR": 800, "Clear": 5000, "F1_415nm": 1390, "F2_445nm": 2168, "F3_480nm": 1954, "F4_515nm": 7997, "F5_555nm": 3644, "F6_590nm": 2488, "F7_630nm": 4083, "F8_680nm": 2487}	\N	\N	1.0000	1.0000	0.0000	\N	\N	0.9953	\N	\N	\N	0.7522	A	\N	\N	\N	t	\N	\N	\N	\N	2026-01-07 10:19:43.740177+00	\N
2026-01-07 10:20:03.780348+00	MG-260107-3731-131	ESP32_DEMO_01	\N	[[95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 36, 61, 94, 95], [95, 95, 95, 33, 18, 78, 90, 95], [95, 95, 94, 25, 35, 90, 94, 95], [95, 98, 73, 40, 95, 95, 95, 95], [95, 100, 100, 100, 95, 95, 95, 95], [95, 98, 100, 98, 95, 95, 95, 95]]	[[75, 71, 67, 76, 79, 70, 74, 75], [70, 77, 72, 75, 72, 74, 74, 74], [74, 69, 75, 76, 58, 55, 75, 75], [76, 79, 74, 57, 57, 49, 71, 69], [74, 73, 48, 54, 53, 73, 64, 76], [73, 71, 52, 56, 69, 72, 76, 74], [72, 77, 75, 74, 73, 73, 73, 70], [74, 77, 79, 72, 81, 77, 71, 69]]	[[255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255]]	\N	\N	970473.44	\N	\N	\N	0.8500	\N	\N	\N	0.1052	REJECT	\N	\N	{"NIR": 800, "Clear": 5000, "F1_415nm": 1416, "F2_445nm": 2191, "F3_480nm": 1906, "F4_515nm": 7880, "F5_555nm": 3728, "F6_590nm": 2291, "F7_630nm": 4002, "F8_680nm": 2543}	\N	\N	1.0000	1.0000	0.0000	\N	\N	1.0000	\N	\N	\N	0.7439	B	\N	\N	\N	t	\N	\N	\N	\N	2026-01-07 10:20:03.782645+00	\N
2026-01-07 10:20:23.75513+00	LL-260107-1488-177	ESP32_DEMO_01	\N	[[95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 52, 95, 95, 95], [95, 95, 95, 65, 33, 90, 94, 95], [95, 95, 95, 36, 22, 80, 90, 95], [95, 95, 95, 28, 34, 90, 94, 95], [95, 98, 100, 33, 62, 95, 95, 95], [95, 100, 100, 59, 95, 95, 95, 95], [95, 98, 100, 98, 95, 95, 95, 95]]	[[72, 79, 74, 76, 64, 71, 79, 73], [74, 77, 72, 70, 51, 74, 72, 73], [74, 76, 74, 57, 60, 74, 78, 74], [73, 69, 78, 53, 54, 77, 74, 77], [77, 72, 63, 55, 45, 72, 69, 78], [73, 74, 71, 67, 64, 76, 74, 77], [73, 72, 69, 58, 78, 72, 74, 72], [70, 76, 67, 70, 73, 69, 70, 71]]	[[255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255]]	\N	\N	1095515.85	\N	\N	\N	0.8500	\N	\N	\N	0.0976	REJECT	\N	\N	{"NIR": 800, "Clear": 5000, "F1_415nm": 1586, "F2_445nm": 2389, "F3_480nm": 1989, "F4_515nm": 7572, "F5_555nm": 3584, "F6_590nm": 2349, "F7_630nm": 4502, "F8_680nm": 2994}	\N	\N	1.0000	1.0000	0.0000	\N	\N	1.0000	\N	\N	\N	0.7588	A	\N	\N	\N	t	\N	\N	\N	\N	2026-01-07 10:20:23.757082+00	\N
2026-01-07 10:20:43.802054+00	LL-260107-1326-081	ESP32_DEMO_01	\N	[[95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 46, 60, 94, 95], [95, 95, 95, 30, 17, 38, 90, 95], [95, 95, 54, 25, 31, 90, 94, 95], [95, 98, 72, 52, 95, 95, 95, 95], [95, 100, 100, 100, 95, 95, 95, 95], [95, 98, 100, 98, 95, 95, 95, 95]]	[[82, 80, 82, 80, 74, 78, 78, 80], [78, 76, 76, 76, 76, 85, 82, 81], [81, 85, 80, 72, 55, 58, 79, 82], [78, 79, 87, 56, 62, 61, 83, 81], [78, 77, 56, 54, 62, 82, 78, 83], [77, 83, 56, 61, 81, 81, 80, 79], [86, 80, 78, 83, 78, 78, 81, 82], [85, 81, 85, 79, 81, 86, 80, 79]]	[[255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255]]	\N	\N	1066854.81	\N	\N	\N	0.8500	\N	\N	\N	0.0572	REJECT	\N	\N	{"NIR": 800, "Clear": 5000, "F1_415nm": 1310, "F2_445nm": 2078, "F3_480nm": 1943, "F4_515nm": 8197, "F5_555nm": 3653, "F6_590nm": 2360, "F7_630nm": 3640, "F8_680nm": 2312}	\N	\N	1.0000	0.8670	0.1330	\N	\N	0.9252	\N	\N	\N	0.7198	B	\N	\N	\N	t	\N	\N	\N	\N	2026-01-07 10:20:43.80433+00	\N
2026-01-07 10:21:03.762027+00	LL-260107-1574-040	ESP32_DEMO_01	\N	[[95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 53, 95, 95, 95], [95, 95, 95, 65, 33, 90, 94, 95], [95, 95, 95, 35, 21, 80, 90, 95], [95, 95, 95, 27, 33, 90, 94, 95], [95, 98, 100, 33, 62, 95, 95, 95], [95, 100, 100, 59, 95, 95, 95, 95], [95, 98, 100, 98, 95, 95, 95, 95]]	[[79, 79, 77, 83, 76, 80, 77, 83], [80, 79, 80, 82, 50, 78, 83, 72], [79, 80, 84, 50, 54, 79, 82, 77], [79, 79, 79, 52, 52, 82, 78, 81], [84, 80, 81, 55, 56, 75, 76, 79], [82, 81, 80, 59, 47, 82, 77, 83], [77, 79, 81, 51, 80, 84, 84, 74], [85, 79, 76, 75, 78, 80, 74, 77]]	[[255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255]]	\N	\N	1097430.09	\N	\N	\N	0.8500	\N	\N	\N	0.0909	REJECT	\N	\N	{"NIR": 800, "Clear": 5000, "F1_415nm": 1570, "F2_445nm": 2359, "F3_480nm": 1977, "F4_515nm": 7591, "F5_555nm": 3591, "F6_590nm": 2313, "F7_630nm": 4411, "F8_680nm": 2942}	\N	\N	1.0000	1.0000	0.0000	\N	\N	1.0000	\N	\N	\N	0.7607	A	\N	\N	\N	t	\N	\N	\N	\N	2026-01-07 10:21:03.764055+00	\N
2026-01-07 10:21:23.802574+00	MG-260107-7719-090	ESP32_DEMO_01	\N	[[95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 45, 59, 94, 95], [95, 95, 95, 30, 17, 39, 90, 95], [95, 95, 55, 25, 31, 90, 94, 95], [95, 98, 72, 51, 95, 95, 95, 95], [95, 100, 100, 100, 95, 95, 95, 95], [95, 98, 100, 98, 95, 95, 95, 95]]	[[75, 78, 77, 77, 79, 70, 78, 72], [69, 72, 75, 80, 75, 74, 78, 82], [76, 79, 72, 75, 51, 53, 74, 79], [75, 73, 75, 52, 54, 54, 73, 72], [78, 71, 47, 54, 47, 79, 74, 78], [79, 76, 52, 54, 79, 78, 74, 76], [72, 76, 77, 81, 78, 80, 78, 78], [77, 75, 73, 73, 78, 77, 76, 74]]	[[255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255]]	\N	\N	1066361.81	\N	\N	\N	0.8500	\N	\N	\N	0.0614	REJECT	\N	\N	{"NIR": 800, "Clear": 5000, "F1_415nm": 1214, "F2_445nm": 1977, "F3_480nm": 1921, "F4_515nm": 8403, "F5_555nm": 3684, "F6_590nm": 2336, "F7_630nm": 3332, "F8_680nm": 2097}	\N	\N	1.0000	0.5800	0.4200	\N	\N	0.5737	\N	\N	\N	0.5875	C	\N	\N	\N	t	\N	\N	\N	\N	2026-01-07 10:21:23.804729+00	\N
2026-01-07 10:21:43.782008+00	MG-260107-4495-146	ESP32_DEMO_01	\N	[[95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 41, 56, 94, 95], [95, 95, 95, 31, 17, 49, 90, 95], [95, 95, 64, 25, 33, 90, 94, 95], [95, 98, 69, 45, 95, 95, 95, 95], [95, 100, 100, 100, 95, 95, 95, 95], [95, 98, 100, 98, 95, 95, 95, 95]]	[[75, 72, 73, 75, 79, 81, 77, 74], [77, 74, 74, 76, 72, 78, 75, 76], [79, 76, 76, 76, 59, 52, 76, 74], [75, 75, 74, 52, 51, 51, 82, 79], [78, 78, 48, 55, 55, 81, 78, 81], [80, 77, 46, 56, 74, 72, 77, 79], [76, 79, 82, 73, 85, 75, 80, 76], [76, 78, 78, 70, 78, 76, 74, 79]]	[[255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255]]	\N	\N	1059950.03	\N	\N	\N	0.8500	\N	\N	\N	0.0623	REJECT	\N	\N	{"NIR": 800, "Clear": 5000, "F1_415nm": 694, "F2_445nm": 1392, "F3_480nm": 1848, "F4_515nm": 10050, "F5_555nm": 3705, "F6_590nm": 2326, "F7_630nm": 1940, "F8_680nm": 949}	\N	\N	0.9135	0.4858	0.5142	\N	\N	0.2983	\N	\N	\N	0.4702	C	\N	\N	\N	t	\N	\N	\N	\N	2026-01-07 10:21:43.783866+00	\N
2026-01-07 10:22:03.803727+00	LL-260107-8725-055	ESP32_DEMO_01	\N	[[95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 46, 60, 94, 95], [95, 95, 95, 30, 17, 39, 90, 95], [95, 95, 54, 25, 31, 90, 94, 95], [95, 98, 72, 51, 95, 95, 95, 95], [95, 100, 100, 100, 95, 95, 95, 95], [95, 98, 100, 98, 95, 95, 95, 95]]	[[69, 68, 68, 69, 71, 70, 64, 66], [64, 66, 72, 67, 70, 66, 66, 63], [71, 70, 72, 71, 57, 58, 71, 65], [66, 68, 76, 58, 65, 60, 68, 71], [67, 68, 58, 57, 55, 69, 69, 69], [68, 69, 51, 55, 66, 64, 72, 66], [65, 65, 71, 65, 73, 65, 69, 71], [70, 67, 68, 69, 70, 69, 69, 69]]	[[255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255]]	\N	\N	1065526.17	\N	\N	\N	0.8500	\N	\N	\N	0.0622	REJECT	\N	\N	{"NIR": 800, "Clear": 5000, "F1_415nm": 1434, "F2_445nm": 2222, "F3_480nm": 2005, "F4_515nm": 7945, "F5_555nm": 3552, "F6_590nm": 2423, "F7_630nm": 4020, "F8_680nm": 2597}	\N	\N	1.0000	1.0000	0.0000	\N	\N	1.0000	\N	\N	\N	0.7667	A	\N	\N	\N	t	\N	\N	\N	\N	2026-01-07 10:22:03.805895+00	\N
2026-01-07 10:22:23.72513+00	LL-260107-1460-057	ESP32_DEMO_01	\N	[[95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 40, 55, 94, 95], [95, 95, 95, 31, 17, 48, 90, 95], [95, 95, 64, 25, 33, 90, 94, 95], [95, 98, 70, 46, 95, 95, 95, 95], [95, 100, 100, 100, 95, 95, 95, 95], [95, 98, 100, 98, 95, 95, 95, 95]]	[[66, 68, 66, 67, 67, 67, 69, 67], [66, 62, 71, 62, 63, 66, 64, 66], [65, 69, 68, 63, 66, 68, 66, 70], [68, 67, 69, 66, 57, 57, 67, 66], [68, 66, 68, 62, 61, 67, 64, 72], [67, 66, 55, 60, 67, 64, 66, 66], [68, 61, 74, 69, 68, 67, 65, 65], [66, 69, 69, 65, 69, 67, 64, 71]]	[[255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255]]	\N	\N	1059988.65	\N	\N	\N	0.8500	\N	\N	\N	0.0631	REJECT	\N	\N	{"NIR": 800, "Clear": 5000, "F1_415nm": 1562, "F2_445nm": 2354, "F3_480nm": 1990, "F4_515nm": 7658, "F5_555nm": 3553, "F6_590nm": 2449, "F7_630nm": 4519, "F8_680nm": 2899}	\N	\N	1.0000	1.0000	0.0000	\N	\N	1.0000	\N	\N	\N	0.7399	B	\N	\N	\N	t	\N	\N	\N	\N	2026-01-07 10:22:23.727343+00	\N
2026-01-07 10:22:43.807216+00	MG-260107-9076-209	ESP32_DEMO_01	\N	[[95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 95, 95, 95, 95], [95, 95, 95, 95, 35, 66, 94, 95], [95, 95, 95, 33, 18, 80, 90, 95], [95, 95, 95, 25, 35, 90, 94, 95], [95, 98, 77, 38, 95, 95, 95, 95], [95, 100, 100, 100, 95, 95, 95, 95], [95, 98, 100, 98, 95, 95, 95, 95]]	[[70, 75, 61, 62, 72, 69, 74, 66], [73, 68, 70, 70, 69, 70, 69, 65], [71, 70, 69, 77, 50, 48, 71, 73], [67, 67, 69, 50, 51, 67, 69, 71], [69, 72, 70, 46, 56, 76, 71, 69], [77, 66, 51, 51, 69, 70, 66, 73], [69, 68, 74, 70, 69, 66, 73, 73], [69, 68, 70, 69, 69, 73, 68, 69]]	[[255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255], [255, 255, 255, 255, 255, 255, 255, 255]]	\N	\N	958542.69	\N	\N	\N	0.8500	\N	\N	\N	0.1224	REJECT	\N	\N	{"NIR": 800, "Clear": 5000, "F1_415nm": 1226, "F2_445nm": 1991, "F3_480nm": 1917, "F4_515nm": 8374, "F5_555nm": 3695, "F6_590nm": 2485, "F7_630nm": 3588, "F8_680nm": 2120}	\N	\N	1.0000	0.5800	0.4200	\N	\N	0.5668	\N	\N	\N	0.6010	B	\N	\N	\N	t	\N	\N	\N	\N	2026-01-07 10:22:43.80949+00	\N
\.


--
-- Data for Name: _hyper_17_28_chunk; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._hyper_17_28_chunk (bucket, device_id, sample_count, count_a_plus, count_a, count_b, count_c, count_reject, avg_quality_score, min_quality_score, max_quality_score, avg_freshness, avg_fat_quality, avg_oxidation, avg_volume, avg_uniformity, count_compliant, last_refresh) FROM stdin;
2026-01-02 08:00:00+00	ESP32-FOIEGRAS-LL-001	11	0	11	0	0	0	0.86632727272727272727	0.8063	0.9374	\N	\N	\N	698534.454545454545	\N	11	2026-01-02 10:31:14.911106+00
2026-01-06 12:00:00+00	TEST	1	1	0	0	0	0	0.86000000000000000000	0.8600	0.8600	0.90000000000000000000	0.85000000000000000000	0.05000000000000000000	500000.000000000000	0.90000000000000000000	1	2026-01-06 14:07:12.484439+00
2026-01-06 13:00:00+00	ESP32_DEMO_01	6	0	3	0	3	0	0.63660000000000000000	0.5052	0.7677	1.00000000000000000000	0.78831666666666666667	0.21168333333333333333	1030595.166666666667	0.85000000000000000000	6	2026-01-06 15:07:12.555057+00
2026-01-07 10:00:00+00	ESP32_DEMO_01	12	0	5	4	3	0	0.69055833333333333333	0.4702	0.7921	0.99279166666666666667	0.84106666666666666667	0.15893333333333333333	1036808.517500000000	0.85000000000000000000	12	2026-01-07 12:30:03.985763+00
\.


--
-- Data for Name: _hyper_18_29_chunk; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._hyper_18_29_chunk (day, site_code, sample_count, count_a_plus, avg_quality_score, avg_freshness, compliance_rate_pct, last_refresh) FROM stdin;
2026-01-02 00:00:00+00	LL	11	0	0.86632727272727272727	\N	100	2026-01-03 10:01:36.085514+00
2026-01-06 00:00:00+00	LL	7	1	0.66851428571428571429	0.98571428571428571429	100	2026-01-07 09:30:03.783848+00
2026-01-07 00:00:00+00	LL	12	0	0.69055833333333333333	0.99279166666666666667	100	2026-01-08 07:12:31.30507+00
\.


--
-- Data for Name: _hyper_1_24_chunk; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._hyper_1_24_chunk ("time", lot_id, jour_gavage, feed_target, feed_real, corn_variation, delta_feed, cumul_corn, created_at, code_lot, jour, moment, dose_theorique, dose_reelle, poids_moyen, nb_vivants, taux_mortalite, temperature, humidite) FROM stdin;
2026-01-01 09:19:52.00897+00	3468	6	\N	\N	\N	\N	\N	2026-01-01 11:19:52.00897+00	LL_JM_2024_01	6	matin	180.00	175.50	520.50	148	1.33	18.50	65.00
2026-01-01 08:47:50.048561+00	3469	8	\N	\N	\N	\N	\N	2026-01-01 11:47:50.048561+00	LL_MP_2024_01	8	matin	190.00	185.00	535.00	197	1.50	19.00	64.00
2026-01-01 10:47:50.048561+00	3470	7	\N	\N	\N	\N	\N	2026-01-01 11:47:50.048561+00	LS_SD_2024_01	7	matin	180.00	177.00	525.00	178	1.11	18.00	65.00
2026-01-01 11:17:50.048561+00	3471	9	\N	\N	\N	\N	\N	2026-01-01 11:47:50.048561+00	MT_PL_2024_01	9	matin	195.00	192.00	545.00	217	1.36	19.50	62.00
\.


--
-- Data for Name: _hyper_1_25_chunk; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._hyper_1_25_chunk ("time", lot_id, jour_gavage, feed_target, feed_real, corn_variation, delta_feed, cumul_corn, created_at, code_lot, jour, moment, dose_theorique, dose_reelle, poids_moyen, nb_vivants, taux_mortalite, temperature, humidite) FROM stdin;
2025-12-31 21:19:52.00897+00	3468	5	\N	\N	\N	\N	\N	2026-01-01 11:19:52.00897+00	LL_JM_2024_01	5	soir	175.00	172.00	515.20	148	1.33	19.00	62.00
2025-12-31 20:47:50.048561+00	3469	7	\N	\N	\N	\N	\N	2026-01-01 11:47:50.048561+00	LL_MP_2024_01	7	soir	185.00	182.00	530.00	197	1.50	18.50	63.00
2025-12-31 22:47:50.048561+00	3470	6	\N	\N	\N	\N	\N	2026-01-01 11:47:50.048561+00	LS_SD_2024_01	6	soir	175.00	173.00	520.00	178	1.11	18.50	64.00
2025-12-31 23:47:50.048561+00	3471	8	\N	\N	\N	\N	\N	2026-01-01 11:47:50.048561+00	MT_PL_2024_01	8	soir	190.00	188.00	540.00	217	1.36	19.00	63.00
\.


--
-- Data for Name: _hyper_22_22_chunk; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._hyper_22_22_chunk (id, lot_id, date_gavage, jour_gavage, dose_matin, dose_soir, heure_gavage_matin, heure_gavage_soir, nb_canards_peses, poids_echantillon, poids_moyen_mesure, gain_poids_jour, gain_poids_cumule, temperature_stabule, humidite_stabule, dose_theorique_matin, dose_theorique_soir, poids_theorique, ecart_dose_pourcent, ecart_poids_pourcent, suit_courbe_theorique, raison_ecart, remarques, mortalite_jour, cause_mortalite, problemes_sante, alerte_generee, niveau_alerte, recommandations_ia, prediction_activee, created_at) FROM stdin;
35	1	2025-12-19	1	145.00	145.00	08:30:00	18:30:00	10	[3550, 3570, 3560, 3560, 3575, 3565, 3585, 3545, 3565, 3535]	3561.00	\N	\N	22.00	65.00	\N	\N	\N	\N	\N	t	\N	[RATTRAPAGE]	0	\N	\N	f	\N	\N	f	2025-12-31 19:21:00.879592+00
36	1	2025-12-20	2	150.00	150.00	08:30:00	18:30:00	10	[3620, 3640, 3630, 3630, 3645, 3635, 3655, 3615, 3635, 3605]	3631.00	\N	\N	22.00	65.00	\N	\N	\N	\N	\N	t	\N	[RATTRAPAGE]	0	\N	\N	f	\N	\N	f	2025-12-31 19:21:00.977581+00
37	1	2025-12-21	3	155.00	155.00	08:30:00	18:30:00	10	[3690, 3710, 3700, 3700, 3715, 3705, 3725, 3685, 3705, 3675]	3701.00	\N	\N	22.00	65.00	\N	\N	\N	\N	\N	t	\N	[RATTRAPAGE]	0	\N	\N	f	\N	\N	f	2025-12-31 19:21:00.982689+00
38	1	2025-12-22	4	160.00	160.00	08:30:00	18:30:00	10	[3760, 3780, 3770, 3770, 3785, 3775, 3795, 3755, 3775, 3745]	3771.00	\N	\N	22.00	65.00	\N	\N	\N	\N	\N	t	\N	[RATTRAPAGE]	0	\N	\N	f	\N	\N	f	2025-12-31 19:21:00.986795+00
39	1	2025-12-23	5	165.00	165.00	08:30:00	18:30:00	10	[3830, 3850, 3840, 3840, 3855, 3845, 3865, 3825, 3845, 3815]	3841.00	\N	\N	22.00	65.00	\N	\N	\N	\N	\N	t	\N	[RATTRAPAGE]	0	\N	\N	f	\N	\N	f	2025-12-31 19:21:00.991108+00
40	1	2025-12-24	6	170.00	170.00	08:30:00	18:30:00	10	[3900, 3920, 3910, 3910, 3925, 3915, 3935, 3895, 3915, 3885]	3911.00	\N	\N	22.00	65.00	\N	\N	\N	\N	\N	t	\N	[RATTRAPAGE]	0	\N	\N	f	\N	\N	f	2025-12-31 19:21:00.99487+00
\.


--
-- Data for Name: _hyper_22_26_chunk; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._hyper_22_26_chunk (id, lot_id, date_gavage, jour_gavage, dose_matin, dose_soir, heure_gavage_matin, heure_gavage_soir, nb_canards_peses, poids_echantillon, poids_moyen_mesure, gain_poids_jour, gain_poids_cumule, temperature_stabule, humidite_stabule, dose_theorique_matin, dose_theorique_soir, poids_theorique, ecart_dose_pourcent, ecart_poids_pourcent, suit_courbe_theorique, raison_ecart, remarques, mortalite_jour, cause_mortalite, problemes_sante, alerte_generee, niveau_alerte, recommandations_ia, prediction_activee, created_at) FROM stdin;
43	1	2026-01-01	14	200.00	200.00	08:30:00	18:30:00	10	[5036.0, 4875.0, 5076.0, 5049.0, 4912.0, 4853.0, 4931.0, 5127.0, 4965.0, 5128.0]	4995.20	\N	\N	22.00	65.00	\N	\N	\N	\N	\N	t	\N		0	\N	\N	f	\N	[]	f	2026-01-01 14:29:29.612858+00
\.


--
-- Data for Name: _hyper_22_6_chunk; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._hyper_22_6_chunk (id, lot_id, date_gavage, jour_gavage, dose_matin, dose_soir, heure_gavage_matin, heure_gavage_soir, nb_canards_peses, poids_echantillon, poids_moyen_mesure, gain_poids_jour, gain_poids_cumule, temperature_stabule, humidite_stabule, dose_theorique_matin, dose_theorique_soir, poids_theorique, ecart_dose_pourcent, ecart_poids_pourcent, suit_courbe_theorique, raison_ecart, remarques, mortalite_jour, cause_mortalite, problemes_sante, alerte_generee, niveau_alerte, recommandations_ia, prediction_activee, created_at) FROM stdin;
2	1	2024-12-28	-355	150.00	150.00	08:30:00	18:30:00	10	[4800.0, 4850.0, 4900.0, 4820.0, 4880.0, 4870.0, 4890.0, 4830.0, 4860.0, 4840.0]	4854.00	\N	\N	22.00	65.00	\N	\N	\N	\N	\N	t	\N	Test	0	\N	\N	f	\N	[]	f	2025-12-28 18:50:27.13617+00
\.


--
-- Data for Name: _hyper_22_7_chunk; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._hyper_22_7_chunk (id, lot_id, date_gavage, jour_gavage, dose_matin, dose_soir, heure_gavage_matin, heure_gavage_soir, nb_canards_peses, poids_echantillon, poids_moyen_mesure, gain_poids_jour, gain_poids_cumule, temperature_stabule, humidite_stabule, dose_theorique_matin, dose_theorique_soir, poids_theorique, ecart_dose_pourcent, ecart_poids_pourcent, suit_courbe_theorique, raison_ecart, remarques, mortalite_jour, cause_mortalite, problemes_sante, alerte_generee, niveau_alerte, recommandations_ia, prediction_activee, created_at) FROM stdin;
4	1	2025-12-29	11	150.00	150.00	08:30:00	18:30:00	10	[4800.0, 4850.0, 4900.0, 4820.0, 4880.0, 4870.0, 4890.0, 4830.0, 4860.0, 4840.0]	4854.00	\N	\N	22.00	65.00	\N	\N	\N	\N	\N	t	\N	Test via curl	0	\N	\N	f	\N	[]	f	2025-12-28 18:50:58.853079+00
8	1	2025-12-30	12	150.00	150.00	08:30:00	18:30:00	10	[4724.0, 4978.0, 4940.0, 4925.0, 4726.0, 4753.0, 4849.0, 4858.0, 4744.0, 4757.0]	4825.40	\N	\N	22.00	65.00	\N	\N	\N	\N	\N	t	\N		0	\N	\N	f	\N	[]	f	2025-12-30 10:46:42.177867+00
24	1	2025-12-26	8	180.00	180.00	08:30:00	18:30:00	10	[4060.0, 4080.0, 4070.0, 4050.0, 4075.0, 4055.0, 4085.0, 4045.0, 4065.0, 4040.0]	4062.50	\N	\N	22.00	65.00	\N	\N	\N	\N	\N	t	\N	[RATTRAPAGE]	0	\N	\N	f	\N	[]	f	2025-12-31 18:05:35.541782+00
25	1	2025-12-27	9	185.00	185.00	08:30:00	18:30:00	10	[4130.0, 4150.0, 4140.0, 4120.0, 4145.0, 4125.0, 4155.0, 4115.0, 4135.0, 4110.0]	4132.50	\N	\N	22.00	65.00	\N	\N	\N	\N	\N	t	\N	[RATTRAPAGE]	0	\N	\N	f	\N	[]	f	2025-12-31 18:05:35.581914+00
26	1	2025-12-28	10	190.00	190.00	08:30:00	18:30:00	10	[4200.0, 4220.0, 4210.0, 4190.0, 4215.0, 4195.0, 4225.0, 4185.0, 4205.0, 4180.0]	4202.50	\N	\N	22.00	65.00	\N	\N	\N	\N	\N	t	\N	[RATTRAPAGE]	0	\N	\N	f	\N	[]	f	2025-12-31 18:05:35.631956+00
41	1	2025-12-25	7	175.00	175.00	08:30:00	18:30:00	10	[3970, 3990, 3980, 3980, 3995, 3985, 4005, 3965, 3985, 3955]	3981.00	\N	\N	22.00	65.00	\N	\N	\N	\N	\N	t	\N	[RATTRAPAGE]	0	\N	\N	f	\N	\N	f	2025-12-31 19:21:00.998648+00
42	1	2025-12-31	13	195.00	195.00	08:30:00	18:30:00	10	[4900.0, 4920.0, 4910.0, 4910.0, 4925.0, 4915.0, 4935.0, 4895.0, 4915.0, 4885.0]	4911.00	\N	\N	22.00	65.00	\N	\N	\N	\N	\N	t	\N	Gavage J13	0	\N	\N	f	\N	[]	f	2025-12-31 20:42:04.343668+00
\.


--
-- Data for Name: _hyper_23_8_chunk; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._hyper_23_8_chunk (lot_id, jour, poids_moyen, dose_moyenne, temperature_moyenne, humidite_moyenne, ecart_moyen, mortalite_totale, nombre_enregistrements, nombre_alertes) FROM stdin;
1	2025-12-29	4854.0000000000000000	300.0000000000000000	22.0000000000000000	65.0000000000000000	\N	0	1	0
1	2025-12-30	4825.4000000000000000	300.0000000000000000	22.0000000000000000	65.0000000000000000	\N	0	1	0
1	2025-12-27	4132.5000000000000000	370.0000000000000000	22.0000000000000000	65.0000000000000000	\N	0	1	0
1	2025-12-26	4062.5000000000000000	360.0000000000000000	22.0000000000000000	65.0000000000000000	\N	0	1	0
1	2025-12-28	4202.5000000000000000	380.0000000000000000	22.0000000000000000	65.0000000000000000	\N	0	1	0
1	2025-12-24	3911.0000000000000000	340.0000000000000000	22.0000000000000000	65.0000000000000000	\N	0	1	0
1	2025-12-23	3841.0000000000000000	330.0000000000000000	22.0000000000000000	65.0000000000000000	\N	0	1	0
1	2025-12-22	3771.0000000000000000	320.0000000000000000	22.0000000000000000	65.0000000000000000	\N	0	1	0
1	2025-12-21	3701.0000000000000000	310.0000000000000000	22.0000000000000000	65.0000000000000000	\N	0	1	0
1	2025-12-20	3631.0000000000000000	300.0000000000000000	22.0000000000000000	65.0000000000000000	\N	0	1	0
1	2025-12-19	3561.0000000000000000	290.0000000000000000	22.0000000000000000	65.0000000000000000	\N	0	1	0
1	2025-12-25	3981.0000000000000000	350.0000000000000000	22.0000000000000000	65.0000000000000000	\N	0	1	0
1	2025-12-31	4911.0000000000000000	390.0000000000000000	22.0000000000000000	65.0000000000000000	\N	0	1	0
1	2026-01-01	4995.2000000000000000	400.0000000000000000	22.0000000000000000	65.0000000000000000	\N	0	1	0
\.


--
-- Data for Name: _hyper_24_219_chunk; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._hyper_24_219_chunk ("time", lot_gavage_id, jour_gavage, repas, dose_moyenne, dose_theorique, poids_moyen_lot, nb_canards_vivants, nb_canards_morts, taux_mortalite, temperature_stabule, humidite_stabule, remarques) FROM stdin;
2026-01-07 20:29:40.3853+00	3487	10	soir	428.90	443.30	6606.20	45	0	2.17	20.1	69.50	\N
2026-01-07 20:29:40.392017+00	3488	10	soir	405.50	425.40	5612.00	51	0	0.00	20.5	60.90	\N
2026-01-07 20:29:40.396584+00	3473	10	soir	442.70	425.40	6652.80	49	0	0.00	19.9	73.40	\N
2026-01-07 20:30:10.42593+00	3487	11	matin	451.50	438.30	6685.20	45	0	2.17	19.6	71.50	\N
2026-01-07 20:30:10.43503+00	3488	11	matin	403.60	420.00	5676.10	50	0	1.96	20.2	57.50	\N
2026-01-07 20:30:10.438905+00	3473	11	matin	411.20	420.00	6733.60	49	0	0.00	19.2	61.40	\N
2026-01-07 20:30:40.446554+00	3487	11	soir	489.00	466.70	6763.50	45	0	2.17	22.3	69.00	\N
2026-01-07 20:30:40.45708+00	3488	11	soir	428.00	446.90	5740.40	50	0	1.96	22.1	66.50	\N
2026-01-07 20:30:40.468231+00	3473	11	soir	443.70	446.90	6812.40	49	0	0.00	20.7	57.40	\N
2026-01-07 20:31:10.514587+00	3487	12	matin	444.00	460.00	6837.30	45	0	2.17	19.8	74.10	\N
2026-01-07 20:31:10.523732+00	3488	12	matin	419.00	440.00	5802.90	50	0	1.96	22.6	66.20	\N
2026-01-07 20:31:10.530494+00	3473	12	matin	459.10	440.00	6890.70	49	0	0.00	19.0	67.40	\N
2026-01-07 20:31:40.56145+00	3487	12	soir	506.10	490.00	6910.70	45	0	2.17	19.4	66.70	\N
2026-01-07 20:31:40.566521+00	3488	12	soir	465.20	468.50	5864.50	50	0	1.96	20.9	64.00	\N
2026-01-07 20:31:40.570021+00	3473	12	soir	446.00	468.50	6968.60	49	0	0.00	22.9	60.60	\N
2026-01-07 20:32:10.594105+00	3488	13	matin	442.60	460.00	5925.20	50	0	1.96	21.8	73.60	\N
2026-01-07 20:32:10.601435+00	3473	13	matin	441.10	460.00	7041.70	49	0	0.00	21.5	55.20	\N
2026-01-07 20:32:40.635539+00	3488	13	soir	473.00	490.00	5985.10	50	0	1.96	22.6	68.20	\N
2026-01-07 20:32:40.642324+00	3473	13	soir	501.70	490.00	7117.00	49	0	0.00	22.8	69.50	\N
2026-01-07 20:33:16.246096+00	3487	0	matin	198.60	200.00	3984.00	53	0	0.00	21.6	59.50	\N
2026-01-07 20:33:16.326146+00	3474	0	matin	199.40	200.00	3991.50	49	0	0.00	21.1	62.70	\N
2026-01-07 20:33:16.329425+00	3473	0	matin	203.70	200.00	4188.30	50	0	0.00	21.8	58.50	\N
2026-01-07 20:33:46.368702+00	3487	0	soir	216.60	210.00	4075.80	53	0	0.00	22.3	66.20	\N
2026-01-07 20:33:46.37304+00	3474	0	soir	208.60	210.00	4080.10	49	0	0.00	19.3	58.80	\N
2026-01-07 20:33:46.375565+00	3473	0	soir	200.10	210.00	4287.10	50	0	0.00	19.7	56.60	\N
2026-01-07 20:34:16.411549+00	3487	1	matin	220.50	220.00	4162.30	53	0	0.00	21.6	69.20	\N
2026-01-07 20:34:16.417111+00	3474	1	matin	215.00	218.60	4166.50	49	0	0.00	21.8	59.10	\N
2026-01-07 20:34:16.425022+00	3473	1	matin	221.00	221.70	4381.00	49	0	2.00	22.8	69.40	\N
2026-01-07 20:34:46.465022+00	3487	1	soir	234.60	231.50	4249.80	53	0	0.00	19.9	58.60	\N
2026-01-07 20:34:46.474388+00	3474	1	soir	233.60	230.00	4255.10	49	0	0.00	20.5	65.70	\N
2026-01-07 20:34:46.479953+00	3473	1	soir	223.00	233.30	4475.70	49	0	2.00	19.4	65.10	\N
2026-01-07 20:35:16.511074+00	3487	2	matin	234.70	240.00	4335.20	53	0	0.00	19.4	57.50	\N
2026-01-07 20:35:16.51621+00	3474	2	matin	230.80	237.10	4343.30	49	0	0.00	22.9	70.00	\N
2026-01-07 20:35:16.520624+00	3473	2	matin	233.80	243.30	4569.00	49	0	2.00	21.6	61.10	\N
2026-01-07 20:35:46.556664+00	3487	2	soir	254.20	253.10	4421.30	53	0	0.00	21.9	72.40	\N
2026-01-07 20:35:46.567189+00	3473	2	soir	265.80	256.70	4661.60	49	0	2.00	20.5	68.30	\N
2026-01-07 20:35:46.56281+00	3474	2	soir	241.00	250.00	4430.00	49	0	0.00	19.8	73.00	\N
2026-01-07 20:36:16.597683+00	3487	3	matin	265.70	260.00	4503.60	53	0	0.00	19.2	71.60	\N
2026-01-07 20:36:16.601405+00	3474	3	matin	246.40	255.70	4516.60	49	0	0.00	21.5	68.00	\N
2026-01-07 20:36:16.604487+00	3473	3	matin	269.00	265.00	4750.00	49	0	2.00	22.5	61.20	\N
2026-01-07 20:36:46.646046+00	3487	3	soir	281.30	274.60	4585.70	53	0	0.00	19.2	62.80	\N
2026-01-07 20:36:46.64994+00	3474	3	soir	268.00	270.00	4599.30	49	0	0.00	19.0	60.70	\N
2026-01-07 20:36:46.653066+00	3473	3	soir	270.20	280.00	4841.00	49	0	2.00	22.4	62.30	\N
2026-01-07 20:37:16.668678+00	3487	4	matin	269.90	280.00	4667.40	53	0	0.00	20.7	64.60	\N
2026-01-07 20:37:16.672704+00	3474	4	matin	262.50	274.30	4678.70	49	0	0.00	20.1	56.90	\N
2026-01-07 20:37:16.676721+00	3473	4	matin	295.70	286.70	4929.40	49	0	2.00	21.2	66.00	\N
2026-01-07 20:37:46.697482+00	3487	4	soir	287.80	296.20	4748.50	53	0	0.00	19.5	64.70	\N
2026-01-07 20:37:46.706208+00	3474	4	soir	301.70	290.00	4760.70	49	0	0.00	19.9	69.20	\N
2026-01-07 20:37:46.712095+00	3473	4	soir	295.80	303.30	5016.30	49	0	2.00	22.8	69.70	\N
2026-01-07 20:38:16.721411+00	3487	5	matin	289.50	300.00	4827.20	53	0	0.00	19.5	62.80	\N
2026-01-07 20:38:16.727957+00	3474	5	matin	306.10	292.90	4839.00	48	0	2.04	19.0	66.60	\N
2026-01-07 20:38:16.733874+00	3473	5	matin	294.40	308.30	5098.80	49	0	2.00	19.7	59.80	\N
2026-01-07 20:38:46.778064+00	3487	5	soir	320.00	317.70	4904.10	53	0	0.00	23.0	58.10	\N
2026-01-07 20:38:46.786056+00	3474	5	soir	323.20	310.00	4918.40	48	0	2.04	21.8	69.60	\N
2026-01-07 20:38:46.791574+00	3473	5	soir	333.80	326.70	5184.10	49	0	2.00	22.4	59.60	\N
2026-01-07 20:39:16.837171+00	3487	6	matin	320.20	320.00	4982.40	53	0	0.00	19.5	62.40	\N
2026-01-07 20:39:16.842229+00	3474	6	matin	302.90	311.40	4995.30	48	0	2.04	19.5	57.50	\N
2026-01-07 20:39:16.847099+00	3473	6	matin	323.70	330.00	5263.00	49	0	2.00	22.3	63.70	\N
2026-01-07 20:39:46.855564+00	3487	6	soir	340.60	339.20	5057.70	53	0	0.00	22.7	64.60	\N
2026-01-07 20:39:46.860926+00	3474	6	soir	321.10	330.00	5073.40	48	0	2.04	21.2	67.10	\N
2026-01-07 20:39:46.865854+00	3473	6	soir	349.10	350.00	5343.30	49	0	2.00	20.2	66.00	\N
2026-01-07 20:40:16.891365+00	3487	7	matin	327.40	340.00	5132.10	52	0	1.89	19.5	68.40	\N
2026-01-07 20:40:16.898574+00	3474	7	matin	327.60	330.00	5148.90	48	0	2.04	22.4	65.00	\N
2026-01-07 20:40:16.903448+00	3473	7	matin	340.10	351.70	5421.30	49	0	2.00	22.5	67.50	\N
2026-01-07 20:40:46.925978+00	3487	7	soir	345.40	360.80	5207.50	52	0	1.89	21.4	67.90	\N
2026-01-07 20:40:46.932967+00	3474	7	soir	358.90	350.00	5224.80	48	0	2.04	20.6	59.20	\N
2026-01-07 20:40:46.938018+00	3473	7	soir	384.00	373.30	5501.00	49	0	2.00	21.7	59.80	\N
2026-01-07 20:41:16.952583+00	3487	8	matin	351.30	360.00	5280.00	52	0	1.89	19.6	56.20	\N
2026-01-07 20:41:16.960207+00	3474	8	matin	334.70	348.60	5300.80	48	0	2.04	19.0	71.10	\N
2026-01-07 20:41:16.965295+00	3473	8	matin	366.60	373.30	5574.10	49	0	2.00	19.5	60.10	\N
2026-01-07 20:41:46.991315+00	3487	8	soir	397.60	382.30	5351.40	52	0	1.89	21.4	70.30	\N
2026-01-07 20:41:46.998267+00	3474	8	soir	380.60	370.00	5373.80	48	0	2.04	21.5	74.10	\N
2026-01-07 20:41:47.005168+00	3473	8	soir	379.60	396.70	5650.40	49	0	2.00	20.7	55.00	\N
2026-01-07 20:42:17.055868+00	3487	9	matin	388.40	380.00	5420.70	52	0	1.89	20.6	70.10	\N
2026-01-07 20:42:17.063476+00	3474	9	matin	379.80	367.10	5445.60	48	0	2.04	20.6	69.80	\N
2026-01-07 20:42:17.070922+00	3473	9	matin	404.30	395.00	5722.70	49	0	2.00	22.5	57.70	\N
2026-01-07 20:42:47.146184+00	3487	9	soir	389.70	403.80	5490.30	52	0	1.89	19.6	66.30	\N
2026-01-07 20:43:47.208597+00	3473	10	soir	435.00	443.30	5936.20	49	0	2.00	20.3	68.80	\N
2026-01-07 20:44:17.241793+00	3487	11	matin	402.10	420.00	5687.80	51	0	3.77	21.2	67.90	\N
2026-01-07 20:44:47.290262+00	3473	11	soir	455.60	466.70	6069.90	47	0	6.00	19.6	56.90	\N
2026-01-07 20:45:17.309926+00	3487	12	matin	441.70	440.00	5813.80	51	0	3.77	21.2	69.70	\N
2026-01-07 20:45:47.350734+00	3473	12	soir	512.50	490.00	6199.20	47	0	6.00	22.6	67.70	\N
2026-01-07 20:46:17.384024+00	3487	13	matin	438.20	460.00	5933.90	51	0	3.77	19.3	63.50	\N
2026-01-07 20:46:47.4095+00	3474	13	soir	451.40	470.00	6044.40	48	0	2.04	20.9	70.30	\N
2026-01-07 20:47:17.438308+00	3474	14	matin	461.40	460.00	6105.20	48	0	2.04	22.7	60.90	\N
2026-01-07 20:47:47.452238+00	3474	14	soir	510.40	490.00	6164.70	48	0	2.04	20.0	69.90	\N
2026-01-07 20:48:23.114679+00	3658	0	matin	210.00	200.00	4618.50	49	0	0.00	22.0	70.40	\N
2026-01-07 20:48:23.187245+00	3489	0	matin	198.70	200.00	4193.80	55	0	0.00	21.4	57.10	\N
2026-01-07 20:48:53.20036+00	3658	0	soir	202.10	210.00	4730.20	49	0	0.00	19.3	73.80	\N
2026-01-07 20:42:47.149111+00	3474	9	soir	399.10	390.00	5516.60	48	0	2.04	19.9	57.00	\N
2026-01-07 20:43:17.161808+00	3487	10	matin	392.60	400.00	5555.50	51	0	3.77	22.5	67.10	\N
2026-01-07 20:43:17.176134+00	3473	10	matin	406.30	416.70	5866.00	49	0	2.00	19.6	57.30	\N
2026-01-07 20:43:47.19954+00	3487	10	soir	411.70	425.40	5623.10	51	0	3.77	21.6	70.10	\N
2026-01-07 20:44:17.255898+00	3473	11	matin	430.00	438.30	6001.30	48	0	4.00	19.4	66.40	\N
2026-01-07 20:44:47.28145+00	3487	11	soir	468.90	446.90	5751.20	51	0	3.77	22.5	59.50	\N
2026-01-07 20:45:17.324183+00	3473	12	matin	453.30	460.00	6133.80	47	0	6.00	22.2	63.20	\N
2026-01-07 20:45:47.340268+00	3487	12	soir	483.60	468.50	5873.80	51	0	3.77	22.4	64.70	\N
2026-01-07 20:48:53.216668+00	3489	0	soir	210.30	210.00	4292.70	54	0	1.82	21.6	71.90	\N
2026-01-07 20:42:47.151384+00	3473	9	soir	417.30	420.00	5796.60	49	0	2.00	22.6	63.80	\N
2026-01-07 20:43:17.169946+00	3474	10	matin	380.40	385.70	5586.00	48	0	2.04	21.1	66.10	\N
2026-01-07 20:43:47.204356+00	3474	10	soir	419.30	410.00	5654.30	48	0	2.04	22.5	66.50	\N
2026-01-07 20:44:17.24951+00	3474	11	matin	410.40	404.30	5722.50	48	0	2.04	20.3	67.10	\N
2026-01-07 20:44:47.286606+00	3474	11	soir	419.70	430.00	5788.00	48	0	2.04	20.1	55.50	\N
2026-01-07 20:45:17.31747+00	3474	12	matin	441.70	422.90	5852.40	48	0	2.04	20.7	62.00	\N
2026-01-07 20:45:47.345344+00	3474	12	soir	442.90	450.00	5916.50	48	0	2.04	22.7	71.90	\N
2026-01-07 20:46:17.39161+00	3474	13	matin	458.60	441.40	5980.50	48	0	2.04	19.8	61.10	\N
2026-01-07 20:46:47.399346+00	3487	13	soir	469.70	490.00	5993.30	51	0	3.77	21.0	66.10	\N
2026-01-07 20:48:23.184464+00	3570	0	matin	200.20	200.00	3994.80	55	0	0.00	20.4	63.90	\N
2026-01-07 20:48:53.209039+00	3570	0	soir	212.40	210.00	4085.70	55	0	0.00	20.8	74.50	\N
2026-01-07 20:49:23.247405+00	3658	1	matin	216.30	220.00	4839.60	49	0	0.00	19.3	72.60	\N
2026-01-07 20:49:23.254093+00	3570	1	matin	221.50	220.00	4172.90	55	0	0.00	20.0	57.60	\N
2026-01-07 20:49:23.26006+00	3489	1	matin	218.90	218.60	4384.00	54	0	1.82	20.1	74.20	\N
2026-01-07 20:49:53.269762+00	3658	1	soir	231.10	231.50	4953.50	49	0	0.00	21.6	57.70	\N
2026-01-07 20:49:53.276168+00	3489	1	soir	235.40	230.00	4480.10	54	0	1.82	22.1	60.60	\N
2026-01-07 20:49:53.273327+00	3570	1	soir	220.00	231.50	4261.10	55	0	0.00	21.9	62.60	\N
2026-01-07 20:50:23.286782+00	3658	2	matin	235.70	240.00	5062.60	49	0	0.00	19.7	71.10	\N
2026-01-07 20:50:23.293195+00	3570	2	matin	237.10	240.00	4347.00	55	0	0.00	20.6	74.40	\N
2026-01-07 20:50:23.298352+00	3489	2	matin	244.90	237.10	4573.10	54	0	1.82	20.8	58.40	\N
2026-01-07 20:50:53.334258+00	3658	2	soir	263.70	253.10	5171.40	49	0	0.00	22.9	72.80	\N
2026-01-07 20:50:53.33973+00	3570	2	soir	248.60	253.10	4432.70	55	0	0.00	22.2	73.90	\N
2026-01-07 20:50:53.34443+00	3489	2	soir	238.00	250.00	4664.80	54	0	1.82	20.4	62.80	\N
2026-01-07 20:51:23.353878+00	3658	3	matin	259.00	260.00	5275.90	49	0	0.00	20.6	57.10	\N
2026-01-07 20:51:23.361106+00	3570	3	matin	254.00	260.00	4517.00	55	0	0.00	19.5	71.70	\N
2026-01-07 20:51:23.366421+00	3489	3	matin	261.80	255.70	4751.00	53	0	3.64	21.7	70.60	\N
2026-01-07 20:51:53.397018+00	3658	3	soir	273.90	274.60	5383.00	49	0	0.00	21.6	59.70	\N
2026-01-07 20:51:53.404392+00	3570	3	soir	261.90	274.60	4598.70	55	0	0.00	20.2	55.30	\N
2026-01-07 20:51:53.408449+00	3489	3	soir	282.40	270.00	4840.80	53	0	3.64	20.8	62.00	\N
2026-01-07 20:52:23.418781+00	3658	4	matin	268.90	280.00	5481.40	49	0	0.00	19.4	69.20	\N
2026-01-07 20:52:23.431104+00	3570	4	matin	292.40	280.00	4679.50	55	0	0.00	22.9	65.20	\N
2026-01-07 20:52:23.437687+00	3489	4	matin	274.70	274.30	4929.30	53	0	3.64	21.8	58.30	\N
2026-01-07 20:52:53.451111+00	3658	4	soir	304.30	296.20	5583.60	49	0	0.00	20.9	56.20	\N
2026-01-07 20:52:53.458737+00	3570	4	soir	291.00	296.20	4759.70	55	0	0.00	21.7	62.10	\N
2026-01-07 20:52:53.466768+00	3489	4	soir	288.40	290.00	5018.50	53	0	3.64	19.5	61.70	\N
2026-01-07 20:53:23.523475+00	3658	5	matin	288.80	300.00	5682.80	49	0	0.00	19.2	63.00	\N
2026-01-07 20:53:23.537695+00	3489	5	matin	298.00	292.90	5104.00	53	0	3.64	20.3	66.10	\N
2026-01-07 20:53:23.531006+00	3570	5	matin	294.30	300.00	4836.50	55	0	0.00	22.7	69.60	\N
2026-01-07 20:53:53.570439+00	3658	5	soir	331.20	317.70	5778.50	49	0	0.00	21.9	64.50	\N
2026-01-07 20:53:53.583909+00	3489	5	soir	314.80	310.00	5189.70	53	0	3.64	21.6	60.90	\N
2026-01-07 20:53:53.577995+00	3570	5	soir	319.60	317.70	4915.40	55	0	0.00	19.3	56.80	\N
2026-01-07 20:54:23.616355+00	3658	6	matin	306.30	320.00	5874.10	49	0	0.00	21.0	59.80	\N
2026-01-07 20:54:23.625467+00	3489	6	matin	302.00	311.40	5272.80	53	0	3.64	21.2	70.60	\N
2026-01-07 20:54:23.622142+00	3570	6	matin	331.90	320.00	4993.30	55	0	0.00	20.0	57.40	\N
2026-01-07 20:54:53.655301+00	3658	6	soir	332.20	339.20	5970.90	49	0	0.00	21.6	57.70	\N
2026-01-07 20:54:53.662504+00	3570	6	soir	340.30	339.20	5068.60	55	0	0.00	21.7	57.60	\N
2026-01-07 20:54:53.667588+00	3489	6	soir	318.60	330.00	5357.60	53	0	3.64	21.0	62.80	\N
2026-01-07 20:55:23.701261+00	3658	7	matin	353.20	340.00	6065.70	49	0	0.00	20.9	58.40	\N
2026-01-07 20:55:23.707638+00	3570	7	matin	344.10	340.00	5141.80	55	0	0.00	21.3	71.90	\N
2026-01-07 20:55:23.713851+00	3489	7	matin	325.50	330.00	5438.20	53	0	3.64	21.5	65.70	\N
2026-01-07 20:55:53.746619+00	3658	7	soir	345.80	360.80	6161.10	49	0	0.00	20.0	56.00	\N
2026-01-07 20:55:53.751319+00	3570	7	soir	346.70	360.80	5216.40	55	0	0.00	21.4	74.70	\N
2026-01-07 20:55:53.757719+00	3489	7	soir	366.90	350.00	5519.60	53	0	3.64	20.4	58.20	\N
2026-01-07 20:56:23.817165+00	3658	8	matin	344.70	360.00	6252.50	49	0	0.00	21.0	56.00	\N
2026-01-07 20:56:23.822377+00	3570	8	matin	362.90	360.00	5288.80	55	0	0.00	19.1	71.30	\N
2026-01-07 20:56:23.829702+00	3489	8	matin	343.80	348.60	5598.10	53	0	3.64	19.4	67.00	\N
2026-01-07 20:56:53.859468+00	3658	8	soir	399.40	382.30	6342.70	49	0	0.00	20.2	65.30	\N
2026-01-07 20:56:53.865363+00	3489	8	soir	373.50	370.00	5678.30	53	0	3.64	20.0	74.00	\N
2026-01-07 20:56:53.8625+00	3570	8	soir	383.30	382.30	5358.80	55	0	0.00	22.3	64.50	\N
2026-01-07 20:57:23.883986+00	3658	9	matin	363.30	380.00	6426.50	48	0	2.04	20.4	62.60	\N
2026-01-07 20:57:23.889903+00	3570	9	matin	386.20	380.00	5428.70	55	0	0.00	22.4	63.70	\N
2026-01-07 20:57:23.895628+00	3489	9	matin	354.80	367.10	5753.80	53	0	3.64	22.4	65.70	\N
2026-01-07 20:57:53.927792+00	3658	9	soir	391.00	403.80	6513.80	48	0	2.04	20.5	63.70	\N
2026-01-07 20:57:53.934165+00	3570	9	soir	400.70	403.80	5498.00	55	0	0.00	19.2	62.10	\N
2026-01-07 20:57:53.940254+00	3489	9	soir	394.70	390.00	5831.30	53	0	3.64	21.7	69.60	\N
2026-01-07 20:58:23.969629+00	3658	10	matin	411.30	400.00	6597.20	48	0	2.04	22.9	61.50	\N
2026-01-07 20:58:23.976027+00	3570	10	matin	407.90	400.00	5565.50	54	0	1.82	19.1	61.30	\N
2026-01-07 20:58:23.982146+00	3489	10	matin	393.30	385.70	5905.20	53	0	3.64	20.0	61.20	\N
2026-01-07 20:58:54.016259+00	3658	10	soir	411.60	425.40	6680.80	48	0	2.04	21.7	68.40	\N
2026-01-07 20:58:54.02254+00	3570	10	soir	430.10	425.40	5633.90	54	0	1.82	22.4	56.30	\N
2026-01-07 20:58:54.027939+00	3489	10	soir	401.80	410.00	5979.60	53	0	3.64	21.1	60.40	\N
2026-01-07 20:59:24.036093+00	3658	11	matin	399.50	420.00	6762.60	48	0	2.04	21.5	66.50	\N
2026-01-07 20:59:24.042573+00	3570	11	matin	400.00	420.00	5697.90	54	0	1.82	20.5	69.00	\N
2026-01-07 20:59:24.04794+00	3489	11	matin	391.00	404.30	6052.40	53	0	3.64	20.8	67.40	\N
2026-01-07 20:59:54.079834+00	3658	11	soir	440.10	446.90	6843.80	48	0	2.04	22.4	55.70	\N
2026-01-07 20:59:54.086874+00	3570	11	soir	432.40	446.90	5762.10	54	0	1.82	19.2	60.10	\N
2026-01-07 20:59:54.093016+00	3489	11	soir	427.10	430.00	6124.00	53	0	3.64	22.0	56.20	\N
2026-01-07 21:00:24.102325+00	3658	12	matin	423.30	440.00	6919.40	48	0	2.04	22.8	59.80	\N
2026-01-07 21:00:24.107323+00	3570	12	matin	442.90	440.00	5824.80	54	0	1.82	22.7	58.80	\N
2026-01-07 21:00:24.11188+00	3489	12	matin	434.70	422.90	6194.30	53	0	3.64	22.7	68.50	\N
2026-01-07 21:00:54.146164+00	3658	12	soir	456.60	468.50	6997.30	48	0	2.04	22.6	66.00	\N
2026-01-07 21:00:54.151392+00	3570	12	soir	473.10	468.50	5886.90	54	0	1.82	19.5	59.30	\N
2026-01-07 21:00:54.155558+00	3489	12	soir	467.50	450.00	6263.80	52	0	5.45	21.2	70.40	\N
2026-01-07 21:01:24.187796+00	3658	13	matin	472.60	460.00	7071.70	48	0	2.04	22.0	55.60	\N
2026-01-07 21:01:24.194217+00	3570	13	matin	470.60	460.00	5947.20	54	0	1.82	21.4	62.40	\N
2026-01-07 21:01:24.200487+00	3489	13	matin	422.80	441.40	6332.60	52	0	5.45	19.9	63.90	\N
2026-01-07 21:01:54.230164+00	3658	13	soir	506.40	490.00	7148.10	48	0	2.04	21.4	62.10	\N
2026-01-07 21:01:54.23498+00	3570	13	soir	508.00	490.00	6007.90	54	0	1.82	21.4	66.10	\N
2026-01-07 21:01:54.241797+00	3489	13	soir	488.70	470.00	6401.30	52	0	5.45	21.9	63.70	\N
2026-01-07 21:02:24.274459+00	3489	14	matin	464.40	460.00	6466.20	52	0	5.45	21.3	74.70	\N
2026-01-07 21:02:54.306572+00	3489	14	soir	484.00	490.00	6532.70	52	0	5.45	21.7	58.40	\N
2026-01-07 21:03:29.918762+00	3487	0	matin	191.10	200.00	4601.70	47	0	0.00	21.8	62.10	\N
2026-01-07 21:03:29.974468+00	3488	0	matin	209.50	200.00	4210.40	45	0	0.00	20.6	68.60	\N
2026-01-07 21:03:29.977594+00	4516	0	matin	191.10	200.00	4606.80	54	0	0.00	21.6	67.30	\N
2026-01-07 21:04:00.005475+00	3487	0	soir	215.50	210.00	4714.60	47	0	0.00	20.3	55.70	\N
2026-01-07 21:04:00.015821+00	4516	0	soir	214.50	210.00	4717.60	54	0	0.00	19.8	74.70	\N
2026-01-07 21:04:30.068392+00	3487	1	matin	216.00	218.60	4821.40	47	0	0.00	22.0	55.10	\N
2026-01-07 21:04:30.07185+00	3488	1	matin	211.00	218.60	4403.80	45	0	0.00	20.6	64.40	\N
2026-01-07 21:04:30.075685+00	4516	1	matin	214.00	218.60	4825.30	54	0	0.00	21.9	64.20	\N
2026-01-07 21:05:00.106684+00	3487	1	soir	221.70	230.00	4930.00	47	0	0.00	22.7	60.30	\N
2026-01-07 21:05:00.109999+00	3488	1	soir	230.30	230.00	4497.70	45	0	0.00	20.5	56.40	\N
2026-01-07 21:05:00.112292+00	4516	1	soir	240.70	230.00	4934.20	54	0	0.00	21.6	70.00	\N
2026-01-07 21:05:30.143116+00	3487	2	matin	225.60	237.10	5035.40	47	0	0.00	21.4	70.90	\N
2026-01-07 21:05:30.146413+00	3488	2	matin	229.50	237.10	4589.10	45	0	0.00	21.8	61.10	\N
2026-01-07 21:05:30.149154+00	4516	2	matin	240.60	237.10	5043.30	54	0	0.00	21.0	68.20	\N
2026-01-07 21:06:00.176315+00	3487	2	soir	246.30	250.00	5139.30	47	0	0.00	20.5	74.10	\N
2026-01-07 21:06:00.17924+00	3488	2	soir	255.90	250.00	4684.50	45	0	0.00	20.2	74.60	\N
2026-01-07 21:06:00.181405+00	4516	2	soir	258.70	250.00	5151.50	54	0	0.00	20.3	64.50	\N
2026-01-07 21:06:30.226002+00	3487	3	matin	264.90	255.70	5239.00	47	0	0.00	21.9	56.20	\N
2026-01-07 21:06:30.229244+00	3488	3	matin	243.10	255.70	4776.10	45	0	0.00	19.4	72.70	\N
2026-01-07 21:06:30.232746+00	4516	3	matin	267.50	255.70	5255.40	54	0	0.00	20.8	64.50	\N
2026-01-07 21:07:00.254213+00	3487	3	soir	270.20	270.00	5344.90	47	0	0.00	22.7	69.80	\N
2026-01-07 21:07:00.25979+00	4516	3	soir	275.50	270.00	5361.50	54	0	0.00	21.2	59.00	\N
2026-01-07 21:07:00.257279+00	3488	3	soir	275.40	270.00	4866.80	45	0	0.00	22.1	65.60	\N
2026-01-07 21:07:30.271414+00	3487	4	matin	262.70	274.30	5447.60	47	0	0.00	20.3	57.10	\N
2026-01-07 21:07:30.277915+00	4516	4	matin	275.50	274.30	5461.80	54	0	0.00	19.0	69.80	\N
2026-01-07 21:07:30.274879+00	3488	4	matin	271.80	274.30	4956.90	45	0	0.00	20.3	69.90	\N
2026-01-07 21:08:00.306643+00	3487	4	soir	293.40	290.00	5548.70	47	0	0.00	22.7	68.40	\N
2026-01-07 21:08:00.309984+00	3488	4	soir	291.30	290.00	5044.40	45	0	0.00	20.4	62.50	\N
2026-01-07 21:08:00.312436+00	4516	4	soir	285.70	290.00	5563.80	54	0	0.00	21.0	72.10	\N
2026-01-07 21:08:30.340156+00	3487	5	matin	307.10	292.90	5646.20	47	0	0.00	21.2	55.20	\N
2026-01-07 21:08:30.343125+00	3488	5	matin	288.30	292.90	5131.90	45	0	0.00	21.3	62.20	\N
2026-01-07 21:08:30.345918+00	4516	5	matin	294.30	292.90	5665.60	54	0	0.00	21.1	65.00	\N
2026-01-07 21:09:00.376292+00	3487	5	soir	306.30	310.00	5749.90	47	0	0.00	20.2	74.40	\N
2026-01-07 21:09:00.379433+00	3488	5	soir	300.70	310.00	5218.20	45	0	0.00	22.0	56.30	\N
2026-01-07 21:09:00.381951+00	4516	5	soir	312.50	310.00	5765.20	54	0	0.00	19.6	70.80	\N
2026-01-07 21:09:30.413369+00	3487	6	matin	312.60	311.40	5846.40	47	0	0.00	21.0	65.60	\N
2026-01-07 21:09:30.421599+00	3488	6	matin	297.60	311.40	5303.00	45	0	0.00	20.0	74.50	\N
2026-01-07 21:09:30.427274+00	4516	6	matin	309.10	311.40	5865.00	54	0	0.00	20.6	68.70	\N
2026-01-07 21:10:00.435905+00	3487	6	soir	329.30	330.00	5944.50	47	0	0.00	20.8	66.80	\N
2026-01-07 21:10:00.44348+00	4516	6	soir	313.80	330.00	5962.00	54	0	0.00	21.1	58.20	\N
2026-01-07 21:10:00.440068+00	3488	6	soir	319.20	330.00	5387.60	45	0	0.00	22.7	58.90	\N
2026-01-07 21:10:30.473988+00	3487	7	matin	328.90	330.00	6039.40	47	0	0.00	19.3	66.00	\N
2026-01-07 21:10:30.481795+00	3488	7	matin	328.00	330.00	5468.90	45	0	0.00	22.7	63.90	\N
2026-01-07 21:10:30.4886+00	4516	7	matin	341.00	330.00	6056.70	54	0	0.00	22.7	63.40	\N
2026-01-07 21:11:00.522512+00	3487	7	soir	351.30	350.00	6129.10	47	0	0.00	19.9	56.70	\N
2026-01-07 21:11:00.527381+00	3488	7	soir	351.60	350.00	5552.50	45	0	0.00	20.7	65.60	\N
2026-01-07 21:11:00.530968+00	4516	7	soir	347.30	350.00	6152.30	54	0	0.00	19.7	68.00	\N
2026-01-07 21:11:30.563885+00	3487	8	matin	355.60	348.60	6220.40	47	0	0.00	22.3	62.60	\N
2026-01-07 21:11:30.571918+00	3488	8	matin	362.80	348.60	5630.50	45	0	0.00	22.7	74.40	\N
2026-01-07 21:11:30.577571+00	4516	8	matin	353.50	348.60	6244.20	54	0	0.00	22.4	71.80	\N
2026-01-07 21:12:00.612038+00	3487	8	soir	371.20	370.00	6312.60	47	0	0.00	22.9	60.50	\N
2026-01-07 21:12:00.615549+00	3488	8	soir	385.00	370.00	5709.50	45	0	0.00	19.4	73.70	\N
2026-01-07 21:12:00.620533+00	4516	8	soir	369.90	370.00	6334.90	54	0	0.00	21.0	61.60	\N
2026-01-07 21:12:30.628161+00	3487	9	matin	364.50	367.10	6400.60	47	0	0.00	20.6	66.90	\N
2026-01-07 21:12:30.634726+00	4516	9	matin	356.90	367.10	6425.20	54	0	0.00	22.5	58.40	\N
2026-01-07 21:12:30.631911+00	3488	9	matin	354.50	367.10	5786.20	45	0	0.00	21.8	59.90	\N
2026-01-07 21:13:00.656927+00	3487	9	soir	372.30	390.00	6489.10	47	0	0.00	19.8	66.70	\N
2026-01-07 21:13:00.664396+00	4516	9	soir	407.30	390.00	6514.30	54	0	0.00	21.5	63.10	\N
2026-01-07 21:13:00.661781+00	3488	9	soir	370.70	390.00	5864.40	45	0	0.00	21.8	59.70	\N
2026-01-07 21:13:30.692325+00	3487	10	matin	393.10	385.70	6575.20	47	0	0.00	19.8	66.50	\N
2026-01-07 21:14:00.709985+00	4516	10	soir	419.30	410.00	6686.00	52	0	3.70	20.4	58.00	\N
2026-01-07 21:14:30.740956+00	3487	11	matin	392.50	404.30	6740.50	47	0	0.00	19.3	65.00	\N
2026-01-07 21:15:00.778225+00	4516	11	soir	421.50	430.00	6848.20	52	0	3.70	20.3	73.80	\N
2026-01-07 21:15:30.789714+00	3487	12	matin	436.20	422.90	6901.60	47	0	0.00	19.9	56.90	\N
2026-01-07 21:15:30.806396+00	4516	12	matin	430.20	422.90	6931.00	52	0	3.70	20.3	55.10	\N
2026-01-07 21:16:01.015285+00	3487	12	soir	439.00	450.00	6985.40	47	0	0.00	21.5	56.30	\N
2026-01-07 21:18:01.210555+00	4516	14	soir	478.90	490.00	7318.50	50	0	7.41	21.9	73.10	\N
2026-01-07 21:18:36.81687+00	3472	0	matin	196.20	200.00	4597.10	48	0	0.00	20.5	55.10	\N
2026-01-07 21:19:06.906624+00	3473	0	soir	210.80	210.00	4732.40	52	0	0.00	20.8	66.00	\N
2026-01-07 21:19:36.946414+00	3474	1	matin	225.00	223.60	4169.90	47	0	2.08	19.4	72.80	\N
2026-01-07 21:20:06.980264+00	3474	1	soir	240.40	235.50	4255.90	47	0	2.08	21.1	72.60	\N
2026-01-07 21:20:37.003811+00	3474	2	matin	241.20	247.30	4340.80	47	0	2.08	19.8	69.60	\N
2026-01-07 21:21:07.04502+00	3474	2	soir	269.60	260.90	4425.60	47	0	2.08	19.1	67.20	\N
2026-01-07 21:21:37.092842+00	3474	3	matin	262.90	270.90	4508.60	47	0	2.08	19.9	71.80	\N
2026-01-07 21:22:07.133515+00	3474	3	soir	292.90	286.40	4587.20	47	0	2.08	21.2	72.70	\N
2026-01-07 21:22:07.144352+00	3473	3	soir	271.70	280.00	5363.30	52	0	0.00	20.6	55.50	\N
2026-01-07 21:22:37.206014+00	3472	4	matin	293.10	286.70	5447.10	48	0	0.00	22.4	71.00	\N
2026-01-07 21:23:07.226573+00	3473	4	soir	310.30	303.30	5562.60	52	0	0.00	20.9	67.90	\N
2026-01-07 21:23:37.254456+00	3472	5	matin	303.80	308.30	5642.20	48	0	0.00	20.2	73.80	\N
2026-01-07 21:24:37.370842+00	3473	6	matin	330.20	330.00	5852.60	51	0	1.92	22.8	73.60	\N
2026-01-07 21:13:30.69905+00	4516	10	matin	398.40	385.70	6600.40	53	0	1.85	21.7	58.40	\N
2026-01-07 21:14:00.699596+00	3487	10	soir	413.50	410.00	6658.90	47	0	0.00	21.2	62.80	\N
2026-01-07 21:14:30.754341+00	4516	11	matin	408.80	404.30	6768.40	52	0	3.70	20.9	69.40	\N
2026-01-07 21:15:00.763485+00	3487	11	soir	446.90	430.00	6821.50	47	0	0.00	20.5	67.50	\N
2026-01-07 21:16:01.027315+00	4516	12	soir	441.80	450.00	7013.30	51	0	5.56	22.8	62.50	\N
2026-01-07 21:16:31.037988+00	3487	13	matin	427.20	441.40	7064.40	47	0	0.00	20.1	55.60	\N
2026-01-07 21:16:31.044427+00	4516	13	matin	448.40	441.40	7092.40	51	0	5.56	21.2	74.80	\N
2026-01-07 21:17:01.087264+00	3487	13	soir	462.40	470.00	7142.40	47	0	0.00	21.1	57.40	\N
2026-01-07 21:17:01.098535+00	4516	13	soir	453.20	470.00	7168.90	50	0	7.41	22.1	74.50	\N
2026-01-07 21:17:31.141472+00	3487	14	matin	454.10	460.00	7218.30	46	0	2.13	22.9	65.80	\N
2026-01-07 21:17:31.153121+00	4516	14	matin	437.70	460.00	7244.30	50	0	7.41	22.2	69.60	\N
2026-01-07 21:18:01.197293+00	3487	14	soir	496.50	490.00	7293.90	46	0	2.13	22.4	55.50	\N
2026-01-07 21:18:36.899116+00	3473	0	matin	195.30	200.00	4618.00	52	0	0.00	19.2	66.00	\N
2026-01-07 21:19:06.901049+00	3472	0	soir	210.70	210.00	4707.00	48	0	0.00	21.9	69.80	\N
2026-01-07 21:19:36.959891+00	3473	1	matin	230.90	221.70	4845.90	52	0	0.00	21.5	56.20	\N
2026-01-07 21:20:06.972765+00	3472	1	soir	240.00	233.30	4926.30	48	0	0.00	20.7	63.50	\N
2026-01-07 21:20:37.009928+00	3473	2	matin	253.80	243.30	5056.50	52	0	0.00	20.4	62.90	\N
2026-01-07 21:21:07.036384+00	3472	2	soir	250.90	256.70	5135.80	48	0	0.00	20.7	72.60	\N
2026-01-07 21:21:37.095146+00	3473	3	matin	277.20	265.00	5259.70	52	0	0.00	22.5	74.90	\N
2026-01-07 21:22:07.124487+00	3472	3	soir	289.30	280.00	5344.00	48	0	0.00	19.9	73.60	\N
2026-01-07 21:22:37.210002+00	3474	4	matin	287.90	294.50	4665.50	47	0	2.08	22.6	63.60	\N
2026-01-07 21:23:07.21998+00	3472	4	soir	308.60	303.30	5547.00	48	0	0.00	20.4	67.00	\N
2026-01-07 21:23:37.265582+00	3473	5	matin	305.30	308.30	5661.90	52	0	0.00	22.9	69.40	\N
2026-01-07 21:24:07.300127+00	3472	5	soir	323.70	326.70	5738.60	48	0	0.00	19.0	71.30	\N
2026-01-07 21:24:37.367493+00	3474	6	matin	336.70	341.80	4975.20	47	0	2.08	21.2	59.10	\N
2026-01-07 21:25:07.388458+00	3472	6	soir	349.90	350.00	5930.30	48	0	0.00	21.9	66.50	\N
2026-01-07 21:26:07.479936+00	3473	7	soir	372.40	373.30	6125.70	50	0	3.85	21.5	56.80	\N
2026-01-07 21:26:37.50708+00	3472	8	matin	388.30	373.30	6199.80	48	0	0.00	20.9	57.00	\N
2026-01-07 21:27:07.55914+00	3473	8	soir	386.90	396.70	6304.10	50	0	3.85	21.3	72.30	\N
2026-01-07 21:27:37.598062+00	3474	9	matin	406.00	412.70	5394.30	46	0	4.17	22.1	56.10	\N
2026-01-07 21:28:07.640136+00	3474	9	soir	434.90	439.10	5459.60	46	0	4.17	19.8	58.90	\N
2026-01-07 21:28:37.687417+00	3474	10	matin	436.10	436.40	5521.60	46	0	4.17	19.6	68.70	\N
2026-01-07 21:29:07.705454+00	3474	10	soir	486.70	464.50	5583.30	46	0	4.17	19.3	59.90	\N
2026-01-07 21:29:37.78127+00	3474	11	matin	447.50	460.00	5643.80	46	0	4.17	20.1	71.60	\N
2026-01-07 21:30:07.792459+00	3472	11	soir	457.60	466.70	6770.00	48	0	0.00	22.5	64.00	\N
2026-01-07 21:33:13.793954+00	3473	1	soir	226.60	230.00	4941.90	55	0	0.00	20.3	60.00	\N
2026-01-07 21:33:43.809068+00	3487	2	matin	247.20	237.10	4574.20	53	0	0.00	19.8	57.00	\N
2026-01-07 21:34:13.845875+00	3473	2	soir	251.50	250.00	5155.20	55	0	0.00	19.7	71.70	\N
2026-01-07 21:34:43.881755+00	3487	3	matin	252.00	255.70	4761.10	53	0	0.00	19.8	55.70	\N
2026-01-07 21:35:13.916078+00	3473	3	soir	278.90	270.00	5360.60	55	0	0.00	19.3	58.10	\N
2026-01-07 21:35:43.925967+00	3487	4	matin	263.40	274.30	4944.00	53	0	0.00	21.8	72.10	\N
2026-01-07 21:36:13.989725+00	3473	4	soir	288.00	290.00	5563.50	55	0	0.00	22.1	70.20	\N
2026-01-07 21:36:44.01305+00	3487	5	matin	304.60	292.90	5116.00	53	0	0.00	19.5	71.50	\N
2026-01-07 21:36:44.023025+00	3473	5	matin	287.10	292.90	5662.40	55	0	0.00	21.6	71.40	\N
2026-01-07 21:37:14.037547+00	3487	5	soir	298.20	310.00	5202.70	53	0	0.00	22.7	55.50	\N
2026-01-07 21:37:44.092475+00	3473	6	matin	301.90	311.40	5856.10	55	0	0.00	20.4	71.50	\N
2026-01-07 21:38:14.119285+00	3487	6	soir	332.70	330.00	5367.60	53	0	0.00	21.5	63.20	\N
2026-01-07 23:17:31.649068+00	3489	3	matin	271.60	270.90	4500.60	48	0	0.00	22.6	71.70	\N
2026-01-07 23:18:01.690342+00	3488	3	soir	292.90	280.00	5357.50	45	0	0.00	21.5	59.40	\N
2026-01-07 23:18:31.722271+00	3488	4	matin	290.20	286.70	5457.50	45	0	0.00	19.6	74.60	\N
2026-01-07 23:19:01.747369+00	3488	4	soir	291.00	303.30	5556.60	45	0	0.00	22.5	64.40	\N
2026-01-07 23:19:31.793234+00	3488	5	matin	309.50	308.30	5656.10	45	0	0.00	22.3	67.50	\N
2026-01-07 23:20:01.826835+00	3488	5	soir	338.70	326.70	5752.00	45	0	0.00	19.1	70.50	\N
2026-01-07 23:20:31.871545+00	3488	6	matin	324.40	330.00	5842.50	45	0	0.00	19.4	59.40	\N
2026-01-07 23:21:01.889277+00	3488	6	soir	366.80	350.00	5937.30	45	0	0.00	21.7	65.80	\N
2026-01-07 23:21:31.920763+00	3488	7	matin	339.80	351.70	6028.50	45	0	0.00	21.6	66.90	\N
2026-01-07 23:22:01.945274+00	3488	7	soir	384.40	373.30	6120.60	45	0	0.00	22.7	72.60	\N
2026-01-07 23:22:31.981876+00	3488	8	matin	387.60	373.30	6206.70	45	0	0.00	19.0	66.00	\N
2026-01-07 23:23:02.025042+00	3488	8	soir	388.70	396.70	6292.80	45	0	0.00	22.8	68.20	\N
2026-01-07 23:23:32.050744+00	3488	9	matin	410.00	395.00	6376.50	45	0	0.00	20.5	58.00	\N
2026-01-07 23:24:02.096373+00	3488	9	soir	433.30	420.00	6459.40	45	0	0.00	22.4	64.10	\N
2026-01-07 23:24:32.109236+00	3472	10	matin	426.10	416.70	6537.30	53	0	0.00	21.1	71.30	\N
2026-01-07 23:25:02.13512+00	3489	10	soir	487.50	464.50	5578.80	45	0	6.25	19.0	64.90	\N
2026-01-07 23:25:32.145508+00	3472	11	matin	439.90	438.30	6696.50	53	0	0.00	20.5	55.80	\N
2026-01-07 21:25:07.391828+00	3474	6	soir	374.30	362.70	5048.60	47	0	2.08	22.4	64.30	\N
2026-01-07 21:25:37.410006+00	3474	7	matin	378.30	365.50	5119.80	47	0	2.08	20.3	74.50	\N
2026-01-07 21:26:07.476871+00	3474	7	soir	376.70	388.20	5192.10	47	0	2.08	21.7	64.70	\N
2026-01-07 21:26:37.518745+00	3473	8	matin	370.50	373.30	6216.20	50	0	3.85	22.2	64.00	\N
2026-01-07 21:27:07.552283+00	3472	8	soir	393.80	396.70	6285.00	48	0	0.00	20.1	56.00	\N
2026-01-07 21:27:37.60191+00	3473	9	matin	413.80	395.00	6390.50	50	0	3.85	19.4	72.40	\N
2026-01-07 21:28:07.63466+00	3472	9	soir	433.80	420.00	6454.70	48	0	0.00	22.6	58.20	\N
2026-01-07 21:28:37.690265+00	3473	10	matin	426.80	416.70	6556.30	50	0	3.85	21.4	66.50	\N
2026-01-07 21:29:07.699315+00	3472	10	soir	455.00	443.30	6614.70	48	0	0.00	20.9	71.20	\N
2026-01-07 21:29:07.713638+00	3473	10	soir	444.30	443.30	6639.50	48	0	7.69	20.8	67.20	\N
2026-01-07 21:29:37.778177+00	3472	11	matin	453.00	438.30	6691.60	48	0	0.00	19.6	72.30	\N
2026-01-07 21:30:07.802524+00	3473	11	soir	451.70	466.70	6793.50	48	0	7.69	20.7	57.50	\N
2026-01-07 21:30:37.836676+00	3472	12	matin	479.10	460.00	6843.70	48	0	0.00	22.8	67.50	\N
2026-01-07 21:31:07.867288+00	3473	12	soir	475.10	490.00	6943.60	48	0	7.69	19.1	68.10	\N
2026-01-07 21:31:43.49773+00	3487	0	matin	206.70	200.00	4198.80	53	0	0.00	21.3	62.40	\N
2026-01-07 21:31:43.571869+00	3473	0	matin	209.70	200.00	4613.20	55	0	0.00	22.3	61.50	\N
2026-01-07 21:32:13.614053+00	3487	0	soir	218.70	210.00	4293.80	53	0	0.00	20.6	69.90	\N
2026-01-07 21:32:13.634555+00	3473	0	soir	207.50	210.00	4724.90	55	0	0.00	19.4	64.00	\N
2026-01-07 21:32:43.699585+00	3487	1	matin	221.90	218.60	4387.40	53	0	0.00	20.3	55.60	\N
2026-01-07 21:32:43.713812+00	3473	1	matin	207.90	218.60	4834.20	55	0	0.00	20.2	64.00	\N
2026-01-07 21:33:13.787445+00	3487	1	soir	238.00	230.00	4481.10	53	0	0.00	21.7	59.60	\N
2026-01-07 21:33:43.823059+00	3473	2	matin	247.90	237.10	5048.70	55	0	0.00	19.6	60.10	\N
2026-01-07 21:34:13.831832+00	3487	2	soir	239.80	250.00	4669.60	53	0	0.00	22.0	61.00	\N
2026-01-07 21:34:43.896252+00	3473	3	matin	268.20	255.70	5256.70	55	0	0.00	21.5	73.20	\N
2026-01-07 21:35:13.904521+00	3487	3	soir	262.60	270.00	4854.00	53	0	0.00	19.3	58.80	\N
2026-01-07 21:35:43.932597+00	3488	4	matin	287.70	286.70	4678.50	53	0	0.00	22.8	57.40	\N
2026-01-07 21:36:13.971948+00	3487	4	soir	282.90	290.00	5030.50	53	0	0.00	20.6	64.70	\N
2026-01-07 21:37:14.050187+00	3473	5	soir	318.70	310.00	5760.70	55	0	0.00	19.4	73.60	\N
2026-01-07 21:37:44.082582+00	3487	6	matin	318.90	311.40	5286.10	53	0	0.00	21.6	67.80	\N
2026-01-07 21:38:14.12488+00	3473	6	soir	327.10	330.00	5955.50	55	0	0.00	21.7	61.30	\N
2026-01-07 21:38:44.154331+00	3487	7	matin	315.20	330.00	5450.60	53	0	0.00	19.1	57.70	\N
2026-01-07 21:38:44.164126+00	3473	7	matin	320.10	330.00	6047.40	55	0	0.00	21.0	73.60	\N
2026-01-07 21:25:07.394822+00	3473	6	soir	350.90	350.00	5946.50	51	0	1.92	19.6	68.50	\N
2026-01-07 21:25:37.402811+00	3472	7	matin	338.30	351.70	6020.30	48	0	0.00	19.1	71.30	\N
2026-01-07 21:25:37.416873+00	3473	7	matin	338.60	351.70	6035.30	50	0	3.85	21.5	64.50	\N
2026-01-07 21:26:07.471253+00	3472	7	soir	369.80	373.30	6111.50	48	0	0.00	19.3	70.20	\N
2026-01-07 21:26:37.513979+00	3474	8	matin	371.40	389.10	5259.70	47	0	2.08	22.2	60.40	\N
2026-01-07 21:27:07.556681+00	3474	8	soir	393.30	413.60	5328.50	47	0	2.08	22.9	59.00	\N
2026-01-07 21:27:37.590003+00	3472	9	matin	388.70	395.00	6368.60	48	0	0.00	20.0	73.50	\N
2026-01-07 21:28:07.64558+00	3473	9	soir	419.80	420.00	6475.20	50	0	3.85	21.4	57.40	\N
2026-01-07 21:28:37.679638+00	3472	10	matin	409.90	416.70	6536.40	48	0	0.00	22.3	56.90	\N
2026-01-07 21:29:37.784027+00	3473	11	matin	449.40	438.30	6715.20	48	0	7.69	19.8	60.30	\N
2026-01-07 21:30:07.798174+00	3474	11	soir	468.10	490.00	5704.90	46	0	4.17	19.1	60.50	\N
2026-01-07 21:30:37.844675+00	3473	12	matin	444.00	460.00	6867.50	48	0	7.69	19.8	62.70	\N
2026-01-07 21:31:07.860375+00	3472	12	soir	506.90	490.00	6917.80	48	0	0.00	22.7	70.30	\N
2026-01-07 21:31:43.569108+00	3488	0	matin	197.10	200.00	4000.30	53	0	0.00	22.7	70.80	\N
2026-01-07 21:32:13.625192+00	3488	0	soir	218.40	210.00	4089.70	53	0	0.00	21.8	58.80	\N
2026-01-07 21:32:43.706855+00	3488	1	matin	213.90	221.70	4176.00	53	0	0.00	20.7	64.00	\N
2026-01-07 21:33:13.791478+00	3488	1	soir	233.40	233.30	4263.00	53	0	0.00	22.8	68.40	\N
2026-01-07 21:33:43.817072+00	3488	2	matin	249.10	243.30	4349.10	53	0	0.00	19.9	57.00	\N
2026-01-07 21:34:13.840158+00	3488	2	soir	265.50	256.70	4432.00	53	0	0.00	19.4	68.60	\N
2026-01-07 21:34:43.889799+00	3488	3	matin	272.60	265.00	4512.20	53	0	0.00	22.8	64.90	\N
2026-01-07 21:35:13.910714+00	3488	3	soir	291.20	280.00	4596.40	53	0	0.00	22.0	63.60	\N
2026-01-07 21:35:43.938202+00	3473	4	matin	281.10	274.30	5462.10	55	0	0.00	22.9	65.10	\N
2026-01-07 21:36:13.981248+00	3488	4	soir	303.30	303.30	4759.80	53	0	0.00	22.4	65.70	\N
2026-01-07 21:36:44.017959+00	3488	5	matin	320.70	308.30	4839.40	53	0	0.00	22.3	69.80	\N
2026-01-07 21:37:14.04471+00	3488	5	soir	323.10	326.70	4915.60	53	0	0.00	21.3	55.30	\N
2026-01-07 21:37:44.088799+00	3488	6	matin	334.30	330.00	4990.30	53	0	0.00	20.9	58.30	\N
2026-01-07 21:38:14.122166+00	3488	6	soir	364.20	350.00	5065.70	53	0	0.00	20.0	57.30	\N
2026-01-07 21:38:44.159361+00	3488	7	matin	365.40	351.70	5137.90	53	0	0.00	22.0	64.70	\N
2026-01-07 21:39:14.217679+00	3487	7	soir	346.60	350.00	5532.80	53	0	0.00	22.4	63.80	\N
2026-01-07 21:39:14.232782+00	3473	7	soir	347.10	350.00	6143.60	55	0	0.00	22.6	61.70	\N
2026-01-07 21:39:44.286364+00	3487	8	matin	345.60	348.60	5610.50	53	0	0.00	19.6	62.00	\N
2026-01-07 21:39:44.301684+00	3473	8	matin	335.20	348.60	6232.80	55	0	0.00	22.4	59.00	\N
2026-01-07 21:40:14.348748+00	3487	8	soir	381.50	370.00	5688.70	53	0	0.00	22.9	65.60	\N
2026-01-07 21:40:44.378733+00	3473	9	matin	368.70	367.10	6413.40	55	0	0.00	20.6	55.50	\N
2026-01-07 21:41:14.411892+00	3488	9	soir	439.20	420.00	5487.20	53	0	0.00	22.6	70.90	\N
2026-01-07 21:41:44.442482+00	3487	10	matin	389.60	385.70	5915.60	53	0	0.00	20.8	68.40	\N
2026-01-07 21:42:14.47492+00	3473	10	soir	413.20	410.00	6672.10	55	0	0.00	22.4	73.90	\N
2026-01-07 21:42:44.514222+00	3488	11	matin	441.50	438.30	5682.50	53	0	0.00	19.1	55.10	\N
2026-01-07 21:43:14.552099+00	3488	11	soir	475.30	466.70	5743.40	51	0	3.77	22.8	71.70	\N
2026-01-07 21:43:44.61242+00	3488	12	matin	438.90	460.00	5804.10	51	0	3.77	21.7	59.70	\N
2026-01-07 21:44:14.67834+00	3488	12	soir	506.40	490.00	5863.60	51	0	3.77	22.1	67.00	\N
2026-01-07 21:44:44.687155+00	3487	13	matin	453.90	441.40	6338.80	53	0	0.00	22.0	55.80	\N
2026-01-07 21:45:14.733754+00	3473	13	soir	474.20	470.00	7158.60	55	0	0.00	19.0	73.60	\N
2026-01-07 21:45:44.763495+00	3487	14	matin	456.30	460.00	6469.00	53	0	0.00	21.3	63.20	\N
2026-01-07 21:46:14.812514+00	3473	14	soir	493.60	490.00	7310.30	55	0	0.00	21.2	66.10	\N
2026-01-07 21:46:50.450145+00	3487	0	matin	192.90	200.00	4205.10	52	0	0.00	19.1	65.70	\N
2026-01-07 21:46:50.518055+00	3473	0	matin	203.70	200.00	3988.20	49	0	0.00	20.4	55.10	\N
2026-01-07 21:47:20.57444+00	3487	0	soir	217.70	210.00	4302.70	52	0	0.00	22.6	65.30	\N
2026-01-07 21:47:50.608692+00	3473	1	matin	230.10	220.00	4166.10	49	0	0.00	19.1	72.00	\N
2026-01-07 21:48:20.641471+00	3487	1	soir	234.90	231.50	4494.40	52	0	0.00	20.1	56.90	\N
2026-01-07 21:48:50.685675+00	3473	2	matin	242.60	240.00	4337.30	49	0	0.00	22.6	60.20	\N
2026-01-07 21:49:20.700832+00	3570	2	soir	243.20	253.10	5175.90	53	0	0.00	21.7	67.20	\N
2026-01-07 21:49:50.772442+00	3570	3	matin	259.30	260.00	5280.40	53	0	0.00	20.0	61.80	\N
2026-01-07 21:50:20.818532+00	3570	3	soir	278.30	274.60	5385.30	53	0	0.00	21.6	66.80	\N
2026-01-07 21:50:50.851858+00	3487	4	matin	281.30	280.00	4947.20	52	0	0.00	19.4	65.80	\N
2026-01-07 21:51:20.87953+00	3473	4	soir	297.50	296.20	4746.50	49	0	0.00	22.0	64.60	\N
2026-01-07 21:51:50.909604+00	3487	5	matin	287.70	300.00	5120.60	52	0	0.00	22.3	72.50	\N
2026-01-07 21:52:20.958511+00	3473	5	soir	321.70	317.70	4906.30	49	0	0.00	23.0	67.10	\N
2026-01-07 21:52:50.996353+00	3570	6	matin	326.40	320.00	5879.40	53	0	0.00	21.2	65.90	\N
2026-01-07 21:52:51.001299+00	3473	6	matin	331.70	320.00	4980.50	49	0	0.00	22.3	60.80	\N
2026-01-07 21:53:21.04501+00	3487	6	soir	352.10	339.20	5368.10	52	0	0.00	21.1	71.60	\N
2026-01-07 21:53:21.055049+00	3473	6	soir	345.30	339.20	5058.40	49	0	0.00	20.3	56.90	\N
2026-01-07 21:53:51.086124+00	3487	7	matin	354.20	340.00	5446.60	51	0	1.92	21.8	61.40	\N
2026-01-07 21:53:51.100002+00	3473	7	matin	349.30	340.00	5132.90	49	0	0.00	20.8	55.90	\N
2026-01-07 21:54:21.141117+00	3487	7	soir	359.40	360.80	5526.60	51	0	1.92	22.1	72.80	\N
2026-01-07 21:54:51.202195+00	3570	8	matin	373.70	360.00	6241.70	53	0	0.00	20.1	67.60	\N
2026-01-07 21:39:14.225803+00	3488	7	soir	391.80	373.30	5210.50	53	0	0.00	22.2	63.90	\N
2026-01-07 21:39:44.293887+00	3488	8	matin	377.70	373.30	5279.70	53	0	0.00	22.9	65.30	\N
2026-01-07 21:40:14.352506+00	3488	8	soir	403.00	396.70	5351.70	53	0	0.00	21.3	66.40	\N
2026-01-07 21:40:44.365288+00	3487	9	matin	354.90	367.10	5765.80	53	0	0.00	21.0	70.30	\N
2026-01-07 21:41:14.415142+00	3473	9	soir	383.20	390.00	6502.40	55	0	0.00	22.7	74.80	\N
2026-01-07 21:41:44.445741+00	3488	10	matin	419.50	416.70	5553.40	53	0	0.00	19.1	66.90	\N
2026-01-07 21:42:14.471822+00	3488	10	soir	428.90	443.30	5618.40	53	0	0.00	20.7	68.70	\N
2026-01-07 21:42:44.506079+00	3487	11	matin	414.40	404.30	6061.30	53	0	0.00	20.2	65.90	\N
2026-01-07 21:44:14.682951+00	3473	12	soir	444.50	450.00	6999.90	55	0	0.00	22.8	61.10	\N
2026-01-07 21:44:44.69467+00	3473	13	matin	431.40	441.40	7080.10	55	0	0.00	21.1	69.10	\N
2026-01-07 21:45:14.729782+00	3487	13	soir	455.30	470.00	6406.20	53	0	0.00	19.3	72.60	\N
2026-01-07 21:45:44.770709+00	3473	14	matin	447.50	460.00	7235.30	55	0	0.00	22.9	60.40	\N
2026-01-07 21:46:14.803791+00	3487	14	soir	495.40	490.00	6536.10	53	0	0.00	22.8	74.60	\N
2026-01-07 21:46:50.514829+00	3570	0	matin	202.50	200.00	4622.20	53	0	0.00	22.0	55.90	\N
2026-01-07 21:47:20.579781+00	3570	0	soir	207.30	210.00	4737.50	53	0	0.00	21.1	55.90	\N
2026-01-07 21:47:50.603143+00	3570	1	matin	209.80	220.00	4849.60	53	0	0.00	19.2	64.30	\N
2026-01-07 21:48:20.646922+00	3570	1	soir	239.60	231.50	4958.60	53	0	0.00	22.3	60.90	\N
2026-01-07 21:48:50.683065+00	3570	2	matin	250.10	240.00	5067.50	53	0	0.00	21.5	61.80	\N
2026-01-07 21:49:20.69753+00	3487	2	soir	252.00	253.10	4680.90	52	0	0.00	20.6	57.40	\N
2026-01-07 21:49:20.703829+00	3473	2	soir	262.30	253.10	4423.00	49	0	0.00	21.6	67.10	\N
2026-01-07 21:49:50.768568+00	3487	3	matin	264.10	260.00	4769.30	52	0	0.00	22.6	56.00	\N
2026-01-07 21:50:50.864202+00	3473	4	matin	270.10	280.00	4666.90	49	0	0.00	20.4	59.20	\N
2026-01-07 21:51:20.87206+00	3487	4	soir	310.00	296.20	5034.30	52	0	0.00	21.8	57.30	\N
2026-01-07 21:51:50.919078+00	3473	5	matin	313.10	300.00	4826.10	49	0	0.00	20.7	63.40	\N
2026-01-07 21:52:20.951474+00	3487	5	soir	326.80	317.70	5203.90	52	0	0.00	22.9	74.40	\N
2026-01-07 21:40:14.35584+00	3473	8	soir	363.30	370.00	6324.00	55	0	0.00	20.2	71.30	\N
2026-01-07 21:40:44.372545+00	3488	9	matin	384.70	395.00	5420.10	53	0	0.00	20.8	73.70	\N
2026-01-07 21:41:14.408333+00	3487	9	soir	376.70	390.00	5842.80	53	0	0.00	21.2	74.00	\N
2026-01-07 21:41:44.448007+00	3473	10	matin	375.60	385.70	6587.90	55	0	0.00	21.0	70.60	\N
2026-01-07 21:42:14.46838+00	3487	10	soir	413.50	410.00	5988.90	53	0	0.00	22.5	56.40	\N
2026-01-07 21:42:44.519448+00	3473	11	matin	396.40	404.30	6755.60	55	0	0.00	22.2	72.00	\N
2026-01-07 21:43:14.543868+00	3487	11	soir	438.20	430.00	6132.80	53	0	0.00	22.4	57.60	\N
2026-01-07 21:43:14.558151+00	3473	11	soir	450.20	430.00	6839.80	55	0	0.00	22.0	73.00	\N
2026-01-07 21:43:44.606059+00	3487	12	matin	412.80	422.90	6204.30	53	0	0.00	20.8	59.30	\N
2026-01-07 21:43:44.618476+00	3473	12	matin	410.40	422.90	6917.10	55	0	0.00	19.0	58.70	\N
2026-01-07 21:44:14.670157+00	3487	12	soir	435.30	450.00	6272.60	53	0	0.00	22.0	59.10	\N
2026-01-07 21:47:20.583576+00	3473	0	soir	215.90	210.00	4077.50	49	0	0.00	20.7	70.80	\N
2026-01-07 21:47:50.597045+00	3487	1	matin	217.80	220.00	4398.60	52	0	0.00	19.8	70.00	\N
2026-01-07 21:48:20.650568+00	3473	1	soir	230.00	231.50	4252.20	49	0	0.00	21.0	56.50	\N
2026-01-07 21:48:50.679349+00	3487	2	matin	232.50	240.00	4587.40	52	0	0.00	21.9	56.10	\N
2026-01-07 21:49:50.775097+00	3473	3	matin	270.00	260.00	4504.50	49	0	0.00	20.7	66.80	\N
2026-01-07 21:50:20.808089+00	3487	3	soir	263.50	274.60	4858.60	52	0	0.00	22.2	66.40	\N
2026-01-07 21:50:20.825631+00	3473	3	soir	275.60	274.60	4587.80	49	0	0.00	20.7	69.30	\N
2026-01-07 21:50:50.858837+00	3570	4	matin	276.60	280.00	5484.10	53	0	0.00	19.1	66.60	\N
2026-01-07 21:51:20.875919+00	3570	4	soir	289.20	296.20	5584.60	53	0	0.00	21.3	68.60	\N
2026-01-07 21:51:50.914575+00	3570	5	matin	303.50	300.00	5683.10	53	0	0.00	22.7	63.10	\N
2026-01-07 21:52:20.954787+00	3570	5	soir	302.20	317.70	5784.50	53	0	0.00	22.2	73.40	\N
2026-01-07 21:52:50.987483+00	3487	6	matin	323.10	320.00	5286.50	52	0	0.00	21.1	59.30	\N
2026-01-07 21:53:21.050799+00	3570	6	soir	333.20	339.20	5972.30	53	0	0.00	21.8	64.20	\N
2026-01-07 21:53:51.093704+00	3570	7	matin	355.40	340.00	6062.10	53	0	0.00	22.2	62.10	\N
2026-01-07 21:54:21.147363+00	3570	7	soir	365.00	360.80	6155.10	53	0	0.00	20.0	55.30	\N
2026-01-07 21:54:21.152372+00	3473	7	soir	349.10	360.80	5205.40	49	0	0.00	22.5	55.70	\N
2026-01-07 21:54:51.194979+00	3487	8	matin	360.00	360.00	5603.30	51	0	1.92	22.8	71.50	\N
2026-01-07 21:54:51.208096+00	3473	8	matin	363.40	360.00	5278.10	49	0	0.00	22.1	73.60	\N
2026-01-07 21:55:21.279614+00	3487	8	soir	393.40	382.30	5681.30	51	0	1.92	20.7	70.90	\N
2026-01-07 21:55:51.312624+00	3473	9	matin	390.40	380.00	5419.50	49	0	0.00	19.5	59.30	\N
2026-01-07 21:56:21.324371+00	3487	9	soir	409.70	403.80	5828.40	51	0	1.92	22.5	72.90	\N
2026-01-07 21:56:51.367786+00	3473	10	matin	395.50	400.00	5555.30	49	0	0.00	22.1	61.00	\N
2026-01-07 21:57:21.383267+00	3570	10	soir	424.00	425.40	6675.50	53	0	0.00	22.0	59.60	\N
2026-01-07 21:57:51.407487+00	3487	11	matin	400.50	420.00	6044.10	50	0	3.85	21.4	64.20	\N
2026-01-07 21:58:21.460134+00	3473	11	soir	448.60	446.90	5753.20	49	0	0.00	20.3	71.90	\N
2026-01-07 21:58:51.484148+00	3487	12	matin	431.80	440.00	6183.00	50	0	3.85	19.7	55.40	\N
2026-01-07 21:59:21.512169+00	3570	12	soir	481.20	468.50	6990.10	53	0	0.00	19.2	72.70	\N
2026-01-07 21:59:51.569552+00	3570	13	matin	469.90	460.00	7065.30	52	0	1.89	19.7	64.20	\N
2026-01-07 22:00:21.607862+00	3570	13	soir	511.50	490.00	7139.90	52	0	1.89	20.9	68.80	\N
2026-01-07 22:00:57.28707+00	3570	0	matin	203.70	200.00	4611.00	51	0	0.00	20.6	63.00	\N
2026-01-07 22:01:27.326461+00	3570	0	soir	201.00	210.00	4723.10	51	0	0.00	21.0	74.90	\N
2026-01-07 22:01:57.401304+00	3570	1	matin	213.70	220.00	4831.70	51	0	0.00	21.4	57.70	\N
2026-01-07 22:02:27.458266+00	3570	1	soir	239.10	231.50	4940.90	51	0	0.00	21.3	56.80	\N
2026-01-07 22:02:57.488348+00	3570	2	matin	246.00	240.00	5049.50	51	0	0.00	19.2	69.80	\N
2026-01-07 22:03:27.54804+00	3570	2	soir	264.90	253.10	5157.60	51	0	0.00	21.0	62.20	\N
2026-01-07 22:03:57.563576+00	3570	3	matin	271.80	260.00	5261.40	51	0	0.00	19.8	58.10	\N
2026-01-07 22:04:27.592052+00	3570	3	soir	279.00	274.60	5365.70	51	0	0.00	19.5	59.20	\N
2026-01-07 22:04:57.621144+00	3570	4	matin	271.70	280.00	5468.60	51	0	0.00	19.7	59.50	\N
2026-01-07 22:05:27.663285+00	3570	4	soir	298.70	296.20	5570.30	51	0	0.00	22.4	62.20	\N
2026-01-07 22:05:57.713618+00	3570	5	matin	296.90	300.00	5669.80	51	0	0.00	22.3	57.90	\N
2026-01-07 22:06:27.744817+00	3570	5	soir	329.00	317.70	5770.80	51	0	0.00	22.0	58.30	\N
2026-01-07 22:06:57.784915+00	3472	6	matin	322.50	311.40	5006.90	52	0	0.00	20.3	59.60	\N
2026-01-07 22:07:27.803553+00	3489	6	soir	349.60	339.20	5055.90	49	0	2.00	20.3	70.40	\N
2026-01-07 22:07:57.83878+00	3472	7	matin	317.80	330.00	5158.70	52	0	0.00	20.9	72.30	\N
2026-01-07 22:08:57.941129+00	3489	8	matin	344.00	360.00	5272.60	49	0	2.00	22.9	66.80	\N
2026-01-07 22:09:27.972891+00	3472	8	soir	363.20	370.00	5379.40	52	0	0.00	22.4	59.80	\N
2026-01-07 22:10:28.060126+00	3489	9	soir	402.20	403.80	5482.70	48	0	4.00	19.4	71.50	\N
2026-01-07 22:10:58.077872+00	3570	10	matin	392.30	400.00	6582.20	51	0	0.00	22.0	57.10	\N
2026-01-07 22:11:28.100275+00	3570	10	soir	418.00	425.40	6665.70	51	0	0.00	19.8	55.30	\N
2026-01-07 22:11:58.134249+00	3570	11	matin	425.60	420.00	6746.30	51	0	0.00	22.6	71.60	\N
2026-01-07 21:55:21.287494+00	3570	8	soir	378.20	382.30	6332.60	53	0	0.00	20.6	71.80	\N
2026-01-07 21:55:51.309945+00	3570	9	matin	379.50	380.00	6419.30	53	0	0.00	22.0	62.00	\N
2026-01-07 21:56:21.32745+00	3570	9	soir	411.30	403.80	6508.60	53	0	0.00	20.6	72.30	\N
2026-01-07 21:56:51.364729+00	3570	10	matin	401.40	400.00	6590.50	53	0	0.00	19.9	73.80	\N
2026-01-07 21:57:21.376659+00	3487	10	soir	440.00	425.40	5973.10	51	0	1.92	22.4	71.00	\N
2026-01-07 21:57:51.416328+00	3473	11	matin	427.60	420.00	5687.90	49	0	0.00	20.0	55.80	\N
2026-01-07 21:58:21.448134+00	3487	11	soir	426.90	446.90	6114.70	50	0	3.85	19.1	68.20	\N
2026-01-07 21:58:51.497102+00	3473	12	matin	428.70	440.00	5813.90	48	0	2.04	20.8	71.50	\N
2026-01-07 21:59:21.505693+00	3487	12	soir	485.70	468.50	6250.30	50	0	3.85	20.7	73.20	\N
2026-01-07 21:59:21.516301+00	3473	12	soir	482.50	468.50	5875.50	48	0	2.04	20.6	59.90	\N
2026-01-07 21:59:51.563339+00	3487	13	matin	462.30	460.00	6315.60	50	0	3.85	19.3	73.40	\N
2026-01-07 22:00:21.614357+00	3473	13	soir	483.90	490.00	5995.50	48	0	2.04	20.7	55.50	\N
2026-01-07 22:00:57.226486+00	3472	0	matin	199.00	200.00	3998.40	52	0	0.00	20.5	57.80	\N
2026-01-07 22:03:27.554723+00	3489	2	soir	259.80	253.10	4421.50	49	0	2.00	19.8	74.20	\N
2026-01-07 22:03:57.55967+00	3472	3	matin	261.70	255.70	4525.20	52	0	0.00	21.2	66.20	\N
2026-01-07 22:03:57.567971+00	3489	3	matin	257.90	260.00	4503.90	49	0	2.00	19.7	59.30	\N
2026-01-07 22:04:27.585774+00	3472	3	soir	274.10	270.00	4609.50	52	0	0.00	21.8	64.40	\N
2026-01-07 22:04:57.626584+00	3489	4	matin	275.70	280.00	4663.90	49	0	2.00	19.8	58.70	\N
2026-01-07 22:05:27.657522+00	3472	4	soir	282.50	290.00	4769.30	52	0	0.00	20.5	61.30	\N
2026-01-07 22:05:57.718415+00	3489	5	matin	308.80	300.00	4821.80	49	0	2.00	21.8	74.40	\N
2026-01-07 22:06:27.737758+00	3472	5	soir	300.30	310.00	4928.00	52	0	0.00	21.9	64.20	\N
2026-01-07 22:06:57.788116+00	3570	6	matin	320.30	320.00	5866.60	51	0	0.00	21.7	64.10	\N
2026-01-07 22:07:27.798748+00	3570	6	soir	339.90	339.20	5962.80	51	0	0.00	22.8	58.30	\N
2026-01-07 22:07:57.842802+00	3570	7	matin	330.80	340.00	6054.80	51	0	0.00	20.6	59.40	\N
2026-01-07 22:08:27.885653+00	3570	7	soir	351.20	360.80	6150.60	51	0	0.00	20.8	71.60	\N
2026-01-07 22:08:57.936496+00	3570	8	matin	359.50	360.00	6239.00	51	0	0.00	20.2	59.50	\N
2026-01-07 22:09:27.978093+00	3570	8	soir	375.40	382.30	6327.00	51	0	0.00	20.2	71.20	\N
2026-01-07 22:09:58.003561+00	3570	9	matin	389.70	380.00	6415.00	51	0	0.00	20.8	55.80	\N
2026-01-07 22:10:28.052917+00	3570	9	soir	407.90	403.80	6500.10	51	0	0.00	21.3	73.40	\N
2026-01-07 22:10:58.070889+00	3472	10	matin	369.70	385.70	5590.30	52	0	0.00	22.6	62.00	\N
2026-01-07 22:11:28.106149+00	3489	10	soir	410.10	425.40	5614.40	48	0	4.00	19.3	57.00	\N
2026-01-07 22:11:58.126996+00	3472	11	matin	418.30	404.30	5724.80	52	0	0.00	20.0	62.10	\N
2026-01-07 21:55:21.293567+00	3473	8	soir	370.90	382.30	5351.10	49	0	0.00	22.3	58.50	\N
2026-01-07 21:55:51.305933+00	3487	9	matin	377.90	380.00	5755.30	51	0	1.92	21.5	64.00	\N
2026-01-07 21:56:21.330136+00	3473	9	soir	398.30	403.80	5489.60	49	0	0.00	20.6	71.10	\N
2026-01-07 21:56:51.360968+00	3487	10	matin	392.50	400.00	5901.20	51	0	1.92	22.8	65.00	\N
2026-01-07 21:57:21.386818+00	3473	10	soir	433.30	425.40	5622.80	49	0	0.00	22.5	59.80	\N
2026-01-07 21:57:51.412194+00	3570	11	matin	400.80	420.00	6755.30	53	0	0.00	19.5	69.30	\N
2026-01-07 21:58:21.454742+00	3570	11	soir	430.30	446.90	6834.70	53	0	0.00	21.2	67.70	\N
2026-01-07 21:58:51.490903+00	3570	12	matin	436.70	440.00	6912.20	53	0	0.00	19.5	65.00	\N
2026-01-07 21:59:51.573989+00	3473	13	matin	440.30	460.00	5935.70	48	0	2.04	21.9	56.40	\N
2026-01-07 22:00:21.600161+00	3487	13	soir	511.50	490.00	6380.90	50	0	3.85	21.8	67.50	\N
2026-01-07 22:00:57.289881+00	3489	0	matin	205.60	200.00	3986.40	50	0	0.00	20.7	56.70	\N
2026-01-07 22:01:27.320563+00	3472	0	soir	206.20	210.00	4090.60	52	0	0.00	21.4	62.40	\N
2026-01-07 22:01:27.331621+00	3489	0	soir	213.90	210.00	4077.40	50	0	0.00	19.1	73.20	\N
2026-01-07 22:01:57.390143+00	3472	1	matin	223.20	218.60	4179.60	52	0	0.00	19.8	62.80	\N
2026-01-07 22:01:57.407743+00	3489	1	matin	210.20	220.00	4164.50	50	0	0.00	20.7	63.00	\N
2026-01-07 22:02:27.454754+00	3472	1	soir	235.30	230.00	4267.20	52	0	0.00	20.3	68.10	\N
2026-01-07 22:02:27.461689+00	3489	1	soir	242.00	231.50	4254.60	49	0	2.00	19.0	63.60	\N
2026-01-07 22:02:57.481309+00	3472	2	matin	227.80	237.10	4355.50	52	0	0.00	21.2	56.60	\N
2026-01-07 22:02:57.494427+00	3489	2	matin	251.80	240.00	4337.00	49	0	2.00	19.9	68.10	\N
2026-01-07 22:03:27.540421+00	3472	2	soir	247.40	250.00	4442.30	52	0	0.00	21.5	70.90	\N
2026-01-07 22:04:27.597376+00	3489	3	soir	283.40	274.60	4583.80	49	0	2.00	19.0	58.00	\N
2026-01-07 22:04:57.615378+00	3472	4	matin	280.70	274.30	4690.10	52	0	0.00	21.8	59.10	\N
2026-01-07 22:05:27.669135+00	3489	4	soir	291.00	296.20	4745.40	49	0	2.00	21.9	74.80	\N
2026-01-07 22:05:57.706368+00	3472	5	matin	297.10	292.90	4850.50	52	0	0.00	21.3	70.40	\N
2026-01-07 22:06:57.7911+00	3489	6	matin	313.70	320.00	4978.50	49	0	2.00	21.5	66.50	\N
2026-01-07 22:07:27.793055+00	3472	6	soir	334.10	330.00	5083.80	52	0	0.00	22.2	59.70	\N
2026-01-07 22:07:57.845385+00	3489	7	matin	328.50	340.00	5130.40	49	0	2.00	22.4	61.50	\N
2026-01-07 22:08:27.877381+00	3472	7	soir	357.90	350.00	5232.90	52	0	0.00	20.1	64.90	\N
2026-01-07 22:08:27.893835+00	3489	7	soir	363.60	360.80	5202.40	49	0	2.00	22.8	58.00	\N
2026-01-07 22:08:57.930255+00	3472	8	matin	345.60	348.60	5306.60	52	0	0.00	20.3	57.60	\N
2026-01-07 22:09:27.982576+00	3489	8	soir	389.30	382.30	5343.40	49	0	2.00	21.4	63.80	\N
2026-01-07 22:09:57.998043+00	3472	9	matin	353.00	367.10	5449.80	52	0	0.00	22.6	64.50	\N
2026-01-07 22:09:58.009498+00	3489	9	matin	382.60	380.00	5413.20	49	0	2.00	21.6	74.90	\N
2026-01-07 22:10:28.044328+00	3472	9	soir	382.40	390.00	5520.80	52	0	0.00	21.5	64.00	\N
2026-01-07 22:10:58.083431+00	3489	10	matin	399.70	400.00	5547.90	48	0	4.00	19.4	56.80	\N
2026-01-07 22:11:28.092571+00	3472	10	soir	411.00	410.00	5658.60	52	0	0.00	19.7	67.50	\N
2026-01-07 22:11:58.142231+00	3489	11	matin	410.50	420.00	5679.70	48	0	4.00	20.3	66.20	\N
2026-01-07 22:12:28.15905+00	3472	11	soir	443.80	430.00	5789.10	52	0	0.00	19.3	59.90	\N
2026-01-07 22:12:58.194465+00	3489	12	matin	457.60	440.00	5804.20	47	0	6.00	22.9	57.00	\N
2026-01-07 22:13:28.215625+00	3472	12	soir	471.00	450.00	5915.60	52	0	0.00	19.1	63.50	\N
2026-01-07 22:14:28.295792+00	3489	13	soir	471.00	490.00	5986.40	47	0	6.00	20.0	74.50	\N
2026-01-07 22:14:58.332471+00	3472	14	matin	438.40	460.00	6101.60	52	0	0.00	20.0	59.80	\N
2026-01-07 22:15:28.358355+00	3472	14	soir	496.60	490.00	6161.90	51	0	1.92	19.3	58.00	\N
2026-01-07 22:16:04.025295+00	3472	0	matin	208.70	200.00	4621.60	54	0	0.00	21.6	74.60	\N
2026-01-07 22:16:34.117637+00	3488	0	soir	210.90	210.00	4736.90	54	0	0.00	22.8	69.90	\N
2026-01-07 22:17:04.158129+00	3488	1	matin	216.00	218.60	4847.20	54	0	0.00	20.6	67.20	\N
2026-01-07 22:17:34.284951+00	3488	1	soir	218.60	230.00	4960.10	54	0	0.00	22.0	67.20	\N
2026-01-07 22:18:04.321869+00	3488	2	matin	227.90	237.10	5066.20	54	0	0.00	21.0	69.70	\N
2026-01-07 22:18:34.350977+00	3472	2	soir	239.30	250.00	5167.80	54	0	0.00	19.3	55.20	\N
2026-01-07 22:19:04.400799+00	3473	3	matin	257.60	255.70	5251.90	54	0	0.00	20.1	64.20	\N
2026-01-07 22:19:34.42902+00	3472	3	soir	280.00	270.00	5373.90	54	0	0.00	19.2	73.70	\N
2026-01-07 22:19:34.444031+00	3473	3	soir	279.70	270.00	5357.70	54	0	0.00	19.8	63.50	\N
2026-01-07 22:20:04.503011+00	3472	4	matin	280.30	274.30	5474.40	54	0	0.00	20.7	56.50	\N
2026-01-07 22:20:34.534001+00	3473	4	soir	293.30	290.00	5559.00	54	0	0.00	20.9	55.60	\N
2026-01-07 22:21:04.541022+00	3472	5	matin	291.90	292.90	5675.30	54	0	0.00	22.5	69.10	\N
2026-01-07 22:21:34.590584+00	3488	5	soir	318.70	310.00	5787.50	53	0	1.85	20.0	62.60	\N
2026-01-07 22:22:04.609138+00	3488	6	matin	308.50	311.40	5886.70	53	0	1.85	22.7	74.40	\N
2026-01-07 22:22:34.651899+00	3488	6	soir	336.40	330.00	5982.10	53	0	1.85	20.2	62.50	\N
2026-01-07 22:23:04.693337+00	3488	7	matin	327.80	330.00	6075.30	53	0	1.85	20.3	70.80	\N
2026-01-07 22:23:34.725485+00	3472	7	soir	366.00	350.00	6152.20	54	0	0.00	21.5	66.20	\N
2026-01-07 22:24:34.871366+00	3473	8	soir	380.30	370.00	6315.20	52	0	3.70	22.6	57.80	\N
2026-01-07 22:25:04.883355+00	3472	9	matin	357.50	367.10	6420.80	54	0	0.00	22.6	73.40	\N
2026-01-07 22:25:34.931561+00	3473	9	soir	388.40	390.00	6491.50	52	0	3.70	21.9	57.30	\N
2026-01-07 22:26:04.960959+00	3472	10	matin	389.60	385.70	6595.10	53	0	1.85	22.4	63.80	\N
2026-01-07 22:26:35.01293+00	3488	10	soir	410.50	410.00	6698.50	53	0	1.85	21.7	60.90	\N
2026-01-07 22:27:05.060015+00	3488	11	matin	386.70	404.30	6779.70	53	0	1.85	21.6	57.20	\N
2026-01-07 22:27:35.101909+00	3488	11	soir	423.10	430.00	6860.30	53	0	1.85	22.0	69.30	\N
2026-01-07 22:28:05.118232+00	3488	12	matin	406.30	422.90	6939.00	53	0	1.85	22.5	60.10	\N
2026-01-07 22:28:35.154748+00	3488	12	soir	457.10	450.00	7019.60	53	0	1.85	22.4	73.40	\N
2026-01-07 22:29:05.188599+00	3472	13	matin	434.20	441.40	7090.90	53	0	1.85	19.2	68.70	\N
2026-01-07 22:30:35.348087+00	3473	14	soir	502.70	490.00	7298.80	52	0	3.70	21.7	58.20	\N
2026-01-07 22:31:10.942367+00	3487	0	matin	205.80	200.00	4610.00	47	0	0.00	19.1	65.30	\N
2026-01-07 22:12:28.171144+00	3489	11	soir	465.00	446.90	5741.80	48	0	4.00	21.5	56.10	\N
2026-01-07 22:12:58.187264+00	3570	12	matin	423.50	440.00	6898.70	50	0	1.96	22.4	72.80	\N
2026-01-07 22:13:28.222618+00	3570	12	soir	467.90	468.50	6977.80	50	0	1.96	19.4	60.10	\N
2026-01-07 22:13:58.236147+00	3472	13	matin	433.80	441.40	5978.00	52	0	0.00	20.9	59.70	\N
2026-01-07 22:13:58.243597+00	3489	13	matin	444.20	460.00	5925.80	47	0	6.00	22.3	59.40	\N
2026-01-07 22:14:28.278515+00	3472	13	soir	490.70	470.00	6041.00	52	0	0.00	19.4	56.20	\N
2026-01-07 22:16:04.093534+00	3473	0	matin	201.60	200.00	4606.30	54	0	0.00	22.8	59.50	\N
2026-01-07 22:16:34.111425+00	3472	0	soir	209.30	210.00	4734.60	54	0	0.00	19.6	74.60	\N
2026-01-07 22:16:34.122169+00	3473	0	soir	218.70	210.00	4718.30	54	0	0.00	20.5	63.80	\N
2026-01-07 22:17:04.151162+00	3472	1	matin	213.80	218.60	4842.70	54	0	0.00	19.6	65.20	\N
2026-01-07 22:17:04.166498+00	3473	1	matin	226.60	218.60	4828.00	54	0	0.00	22.2	58.50	\N
2026-01-07 22:17:34.276099+00	3472	1	soir	233.50	230.00	4953.80	54	0	0.00	22.9	67.30	\N
2026-01-07 22:18:04.324747+00	3473	2	matin	246.70	237.10	5043.80	54	0	0.00	21.4	70.90	\N
2026-01-07 22:18:34.354032+00	3488	2	soir	249.80	250.00	5174.30	54	0	0.00	20.0	68.50	\N
2026-01-07 22:19:04.387007+00	3472	3	matin	253.80	255.70	5269.70	54	0	0.00	21.2	57.00	\N
2026-01-07 22:20:04.515103+00	3473	4	matin	271.10	274.30	5458.70	54	0	0.00	20.0	66.20	\N
2026-01-07 22:20:34.521571+00	3472	4	soir	295.30	290.00	5575.20	54	0	0.00	19.8	67.60	\N
2026-01-07 22:21:04.553631+00	3473	5	matin	287.20	292.90	5654.60	53	0	1.85	20.3	67.70	\N
2026-01-07 22:21:34.587234+00	3472	5	soir	316.50	310.00	5777.40	54	0	0.00	22.9	64.20	\N
2026-01-07 22:21:34.595446+00	3473	5	soir	315.10	310.00	5754.70	53	0	1.85	20.2	61.70	\N
2026-01-07 22:22:04.601429+00	3472	6	matin	310.90	311.40	5872.90	54	0	0.00	19.5	66.90	\N
2026-01-07 22:22:34.657171+00	3473	6	soir	336.10	330.00	5948.10	53	0	1.85	22.9	70.10	\N
2026-01-07 22:23:04.689504+00	3472	7	matin	329.10	330.00	6061.50	54	0	0.00	19.7	55.70	\N
2026-01-07 22:23:34.741128+00	3473	7	soir	352.20	350.00	6137.90	53	0	1.85	20.5	58.80	\N
2026-01-07 22:24:04.778031+00	3472	8	matin	336.40	348.60	6244.70	54	0	0.00	20.4	60.60	\N
2026-01-07 22:24:04.791424+00	3473	8	matin	362.90	348.60	6225.10	52	0	3.70	20.3	68.60	\N
2026-01-07 22:24:34.858501+00	3472	8	soir	367.10	370.00	6332.90	54	0	0.00	21.2	58.00	\N
2026-01-07 22:25:04.889181+00	3473	9	matin	365.60	367.10	6402.00	52	0	3.70	19.6	57.80	\N
2026-01-07 22:25:34.920076+00	3472	9	soir	372.20	390.00	6509.80	54	0	0.00	22.9	67.60	\N
2026-01-07 22:26:04.973607+00	3473	10	matin	372.70	385.70	6579.70	52	0	3.70	22.4	72.30	\N
2026-01-07 22:26:35.006731+00	3472	10	soir	417.20	410.00	6685.20	53	0	1.85	23.0	58.40	\N
2026-01-07 22:27:05.065808+00	3473	11	matin	389.40	404.30	6750.10	52	0	3.70	22.0	72.10	\N
2026-01-07 22:27:35.098642+00	3472	11	soir	421.00	430.00	6851.80	53	0	1.85	22.5	68.80	\N
2026-01-07 22:28:05.120823+00	3473	12	matin	434.10	422.90	6911.10	52	0	3.70	21.2	61.40	\N
2026-01-07 22:28:35.151326+00	3472	12	soir	471.10	450.00	7012.90	53	0	1.85	23.0	72.30	\N
2026-01-07 22:29:05.205012+00	3473	13	matin	434.50	441.40	7069.30	52	0	3.70	22.0	74.30	\N
2026-01-07 22:29:35.211745+00	3472	13	soir	487.50	470.00	7170.10	53	0	1.85	21.0	60.50	\N
2026-01-07 22:29:35.222543+00	3473	13	soir	447.40	470.00	7149.50	52	0	3.70	21.4	59.60	\N
2026-01-07 22:30:05.268449+00	3472	14	matin	458.10	460.00	7244.30	53	0	1.85	22.7	59.00	\N
2026-01-07 22:30:05.282563+00	3473	14	matin	480.70	460.00	7224.70	52	0	3.70	19.9	74.30	\N
2026-01-07 22:30:35.341768+00	3472	14	soir	479.80	490.00	7319.70	53	0	1.85	21.7	61.20	\N
2026-01-07 22:31:11.013519+00	3489	0	matin	203.90	200.00	3972.80	45	0	0.00	20.8	63.80	\N
2026-01-07 22:12:28.165858+00	3570	11	soir	454.30	446.90	6821.40	50	0	1.96	22.1	70.50	\N
2026-01-07 22:12:58.179772+00	3472	12	matin	404.10	422.90	5851.50	52	0	0.00	20.8	56.10	\N
2026-01-07 22:13:28.228233+00	3489	12	soir	465.60	468.50	5865.90	47	0	6.00	21.3	56.80	\N
2026-01-07 22:13:58.240801+00	3570	13	matin	473.30	460.00	7054.10	50	0	1.96	19.0	59.50	\N
2026-01-07 22:14:28.286515+00	3570	13	soir	471.50	490.00	7130.10	50	0	1.96	19.2	60.60	\N
2026-01-07 22:16:04.083225+00	3488	0	matin	193.40	200.00	4625.50	54	0	0.00	22.9	68.20	\N
2026-01-07 22:17:34.290065+00	3473	1	soir	224.00	230.00	4939.30	54	0	0.00	21.5	64.90	\N
2026-01-07 22:18:04.318553+00	3472	2	matin	227.30	237.10	5061.20	54	0	0.00	21.4	66.00	\N
2026-01-07 22:18:34.357688+00	3473	2	soir	246.30	250.00	5151.70	54	0	0.00	22.2	66.00	\N
2026-01-07 22:19:04.393734+00	3488	3	matin	260.00	255.70	5277.40	54	0	0.00	19.2	62.00	\N
2026-01-07 22:19:34.437436+00	3488	3	soir	258.70	270.00	5385.20	54	0	0.00	19.3	66.20	\N
2026-01-07 22:20:04.51+00	3488	4	matin	284.70	274.30	5487.70	54	0	0.00	20.3	57.10	\N
2026-01-07 22:20:34.528101+00	3488	4	soir	283.10	290.00	5589.70	53	0	1.85	20.5	70.00	\N
2026-01-07 22:21:04.547973+00	3488	5	matin	279.50	292.90	5688.30	53	0	1.85	19.6	56.10	\N
2026-01-07 22:22:04.614548+00	3473	6	matin	313.20	311.40	5851.90	53	0	1.85	22.3	69.50	\N
2026-01-07 22:22:34.647522+00	3472	6	soir	334.10	330.00	5969.60	54	0	0.00	21.2	68.00	\N
2026-01-07 22:23:04.695848+00	3473	7	matin	316.70	330.00	6042.30	53	0	1.85	21.6	58.20	\N
2026-01-07 22:23:34.734961+00	3488	7	soir	367.40	350.00	6165.50	53	0	1.85	20.1	71.90	\N
2026-01-07 22:24:04.785614+00	3488	8	matin	336.30	348.60	6258.90	53	0	1.85	21.2	55.20	\N
2026-01-07 22:24:34.865811+00	3488	8	soir	360.60	370.00	6349.00	53	0	1.85	20.2	70.50	\N
2026-01-07 22:25:04.88644+00	3488	9	matin	377.90	367.10	6437.60	53	0	1.85	19.0	70.70	\N
2026-01-07 22:25:34.926782+00	3488	9	soir	385.50	390.00	6526.00	53	0	1.85	22.3	74.40	\N
2026-01-07 22:26:04.967423+00	3488	10	matin	401.60	385.70	6611.60	53	0	1.85	20.6	72.70	\N
2026-01-07 22:26:35.018895+00	3473	10	soir	398.80	410.00	6668.00	52	0	3.70	22.4	69.70	\N
2026-01-07 22:27:05.05262+00	3472	11	matin	423.50	404.30	6768.10	53	0	1.85	21.4	59.00	\N
2026-01-07 22:27:35.104703+00	3473	11	soir	447.20	430.00	6832.30	52	0	3.70	21.6	72.60	\N
2026-01-07 22:28:05.111217+00	3472	12	matin	418.80	422.90	6934.00	53	0	1.85	19.4	69.40	\N
2026-01-07 22:28:35.157146+00	3473	12	soir	471.50	450.00	6992.80	52	0	3.70	21.0	55.20	\N
2026-01-07 22:29:05.196914+00	3488	13	matin	462.50	441.40	7097.10	53	0	1.85	21.7	56.30	\N
2026-01-07 22:29:35.217119+00	3488	13	soir	487.00	470.00	7177.20	52	0	3.70	20.9	55.70	\N
2026-01-07 22:30:05.27584+00	3488	14	matin	445.90	460.00	7250.90	52	0	3.70	21.6	56.60	\N
2026-01-07 22:30:35.345155+00	3488	14	soir	484.00	490.00	7325.10	52	0	3.70	19.8	73.90	\N
2026-01-07 22:31:11.010377+00	3474	0	matin	190.30	200.00	4185.30	53	0	0.00	19.5	60.60	\N
2026-01-07 22:31:41.032871+00	3487	0	soir	207.40	210.00	4724.40	47	0	0.00	20.0	70.40	\N
2026-01-07 22:32:11.078627+00	3489	1	matin	214.90	223.60	4151.60	45	0	0.00	21.1	63.50	\N
2026-01-07 22:32:41.08893+00	3487	1	soir	239.60	233.30	4941.30	47	0	0.00	22.2	74.60	\N
2026-01-07 22:33:11.147128+00	3489	2	matin	236.20	247.30	4323.90	45	0	0.00	22.9	63.10	\N
2026-01-07 22:33:41.163091+00	3474	2	soir	264.50	260.90	4656.80	53	0	0.00	22.1	55.80	\N
2026-01-07 22:34:11.183459+00	3474	3	matin	272.50	270.90	4745.60	53	0	0.00	19.2	70.30	\N
2026-01-07 22:34:41.211484+00	3487	3	soir	277.10	280.00	5365.80	47	0	0.00	19.1	69.10	\N
2026-01-07 22:35:11.269953+00	3489	4	matin	307.40	294.50	4648.60	45	0	0.00	20.5	74.80	\N
2026-01-07 22:35:41.285404+00	3474	4	soir	305.40	311.80	5006.40	53	0	0.00	20.9	68.30	\N
2026-01-07 22:36:11.311956+00	3487	5	matin	293.20	308.30	5666.80	47	0	0.00	19.6	70.70	\N
2026-01-07 22:36:41.366249+00	3489	5	soir	353.60	337.30	4877.70	45	0	0.00	22.7	62.50	\N
2026-01-07 22:37:11.376084+00	3487	6	matin	324.80	330.00	5855.20	47	0	0.00	21.1	66.80	\N
2026-01-07 22:37:11.384727+00	3489	6	matin	331.10	341.80	4951.70	45	0	0.00	21.9	56.50	\N
2026-01-07 22:37:41.430411+00	3487	6	soir	338.00	350.00	5945.90	47	0	0.00	21.2	63.00	\N
2026-01-07 22:39:11.597028+00	3489	8	matin	393.50	389.10	5236.70	45	0	0.00	22.3	67.90	\N
2026-01-07 22:39:41.625659+00	3487	8	soir	411.00	396.70	6299.70	47	0	0.00	20.4	73.80	\N
2026-01-07 22:39:41.632738+00	3489	8	soir	428.30	413.60	5305.50	45	0	0.00	19.4	73.20	\N
2026-01-07 22:40:11.679858+00	3487	9	matin	396.60	395.00	6383.70	47	0	0.00	21.9	58.30	\N
2026-01-07 22:40:41.733622+00	3489	9	soir	448.80	439.10	5434.20	45	0	0.00	19.9	73.20	\N
2026-01-07 22:41:11.767754+00	3487	10	matin	416.30	416.70	6551.60	47	0	0.00	20.0	69.00	\N
2026-01-07 22:41:41.824018+00	3489	10	soir	467.40	464.50	5560.40	45	0	0.00	22.2	63.00	\N
2026-01-07 22:42:11.831774+00	3487	11	matin	432.40	438.30	6710.70	47	0	0.00	21.5	66.20	\N
2026-01-07 22:42:41.888337+00	3489	11	soir	486.90	490.00	5680.20	45	0	0.00	23.0	71.50	\N
2026-01-07 22:44:17.712988+00	3474	0	matin	205.40	200.00	4594.90	49	0	0.00	19.6	72.60	\N
2026-01-07 22:44:47.717558+00	3472	0	soir	213.60	210.00	4291.20	53	0	0.00	21.0	62.90	\N
2026-01-07 22:45:47.805603+00	3489	1	soir	220.80	230.00	4947.50	51	0	0.00	22.9	66.80	\N
2026-01-07 22:46:17.842138+00	3472	2	matin	259.60	247.30	4575.30	53	0	0.00	19.3	74.00	\N
2026-01-07 22:46:47.878748+00	3489	2	soir	260.50	250.00	5166.00	51	0	0.00	22.1	67.90	\N
2026-01-07 22:47:17.90112+00	3472	3	matin	268.80	270.90	4755.70	53	0	0.00	21.7	69.30	\N
2026-01-07 22:49:18.074134+00	3489	5	matin	287.90	292.90	5678.50	51	0	0.00	21.7	71.90	\N
2026-01-07 22:49:48.108565+00	3472	5	soir	342.90	337.30	5180.00	53	0	0.00	22.8	73.50	\N
2026-01-07 22:51:18.263298+00	3489	7	matin	332.70	330.00	6066.30	51	0	0.00	20.7	73.80	\N
2026-01-07 22:51:48.2929+00	3472	7	soir	370.70	388.20	5491.90	53	0	0.00	22.0	59.30	\N
2026-01-07 22:52:18.341863+00	3489	8	matin	342.80	348.60	6255.10	51	0	0.00	22.7	67.90	\N
2026-01-07 22:31:41.036611+00	3474	0	soir	202.40	210.00	4283.90	53	0	0.00	21.1	56.40	\N
2026-01-07 22:32:11.066157+00	3487	1	matin	223.60	221.70	4833.20	47	0	0.00	19.7	63.00	\N
2026-01-07 22:32:41.103906+00	3489	1	soir	237.00	235.50	4240.40	45	0	0.00	21.4	66.60	\N
2026-01-07 22:33:11.136994+00	3487	2	matin	235.00	243.30	5051.70	47	0	0.00	21.5	57.20	\N
2026-01-07 22:33:41.169777+00	3489	2	soir	257.70	260.90	4406.20	45	0	0.00	19.9	58.00	\N
2026-01-07 22:34:11.179856+00	3487	3	matin	257.30	265.00	5263.70	47	0	0.00	20.9	73.00	\N
2026-01-07 22:34:41.228488+00	3489	3	soir	282.20	286.40	4569.40	45	0	0.00	19.3	68.60	\N
2026-01-07 22:35:11.259574+00	3487	4	matin	283.40	286.70	5469.10	47	0	0.00	22.7	59.30	\N
2026-01-07 22:35:41.288123+00	3489	4	soir	312.10	311.80	4727.20	45	0	0.00	22.9	63.70	\N
2026-01-07 22:36:11.316323+00	3474	5	matin	328.80	318.20	5087.50	53	0	0.00	19.3	65.50	\N
2026-01-07 22:36:41.360004+00	3474	5	soir	352.80	337.30	5168.70	52	0	1.89	20.9	59.20	\N
2026-01-07 22:37:11.380758+00	3474	6	matin	327.20	341.80	5249.70	52	0	1.89	19.3	63.10	\N
2026-01-07 22:37:41.43627+00	3474	6	soir	369.00	362.70	5329.60	52	0	1.89	19.8	69.20	\N
2026-01-07 22:38:11.469329+00	3487	7	matin	367.30	351.70	6035.00	47	0	0.00	22.7	60.10	\N
2026-01-07 22:38:11.481566+00	3489	7	matin	376.70	365.50	5095.60	45	0	0.00	20.3	67.30	\N
2026-01-07 22:38:41.534999+00	3487	7	soir	385.40	373.30	6125.20	47	0	0.00	19.8	71.90	\N
2026-01-07 22:38:41.548079+00	3489	7	soir	386.50	388.20	5169.00	45	0	0.00	21.0	70.70	\N
2026-01-07 22:39:11.591319+00	3487	8	matin	356.60	373.30	6212.70	47	0	0.00	20.1	73.20	\N
2026-01-07 22:40:11.693791+00	3489	9	matin	422.90	412.70	5370.60	45	0	0.00	19.3	70.70	\N
2026-01-07 22:40:41.719516+00	3487	9	soir	425.60	420.00	6470.60	47	0	0.00	19.9	60.90	\N
2026-01-07 22:41:11.780811+00	3489	10	matin	438.80	436.40	5495.60	45	0	0.00	20.7	58.00	\N
2026-01-07 22:41:41.81953+00	3474	10	soir	452.70	464.50	5917.50	51	0	3.77	20.7	70.70	\N
2026-01-07 22:42:11.839333+00	3474	11	matin	482.50	460.00	5982.60	51	0	3.77	19.6	55.60	\N
2026-01-07 22:42:41.883015+00	3474	11	soir	470.00	490.00	6048.50	51	0	3.77	20.0	72.20	\N
2026-01-07 22:43:11.923952+00	3487	12	matin	437.50	460.00	6864.00	47	0	0.00	22.9	71.00	\N
2026-01-07 22:43:41.952951+00	3487	12	soir	493.50	490.00	6937.60	46	0	2.13	21.3	58.50	\N
2026-01-07 22:44:17.643617+00	3472	0	matin	206.30	200.00	4193.30	53	0	0.00	21.0	55.50	\N
2026-01-07 22:44:47.723919+00	3489	0	soir	218.90	210.00	4723.50	51	0	0.00	22.1	59.50	\N
2026-01-07 22:45:17.754758+00	3472	1	matin	221.30	223.60	4386.50	53	0	0.00	20.3	63.20	\N
2026-01-07 22:45:17.768229+00	3489	1	matin	208.30	218.60	4833.90	51	0	0.00	21.3	73.00	\N
2026-01-07 22:45:47.789516+00	3472	1	soir	245.60	235.50	4480.40	53	0	0.00	22.6	59.40	\N
2026-01-07 22:46:17.854544+00	3489	2	matin	230.90	237.10	5057.10	51	0	0.00	22.8	73.20	\N
2026-01-07 22:46:47.864624+00	3472	2	soir	264.20	260.90	4664.90	53	0	0.00	23.0	64.70	\N
2026-01-07 22:47:17.907159+00	3489	3	matin	256.10	255.70	5270.50	51	0	0.00	19.9	71.80	\N
2026-01-07 22:47:47.915781+00	3472	3	soir	281.70	286.40	4844.00	53	0	0.00	19.1	63.50	\N
2026-01-07 22:47:47.93249+00	3489	3	soir	269.80	270.00	5376.10	51	0	0.00	22.6	58.50	\N
2026-01-07 22:48:17.969627+00	3472	4	matin	295.10	294.50	4929.40	53	0	0.00	20.2	60.10	\N
2026-01-07 22:48:17.98347+00	3489	4	matin	269.30	274.30	5476.60	51	0	0.00	21.0	67.80	\N
2026-01-07 22:48:48.029074+00	3472	4	soir	311.80	311.80	5014.70	53	0	0.00	21.8	61.30	\N
2026-01-07 22:48:48.040654+00	3489	4	soir	290.10	290.00	5579.30	51	0	0.00	20.1	65.90	\N
2026-01-07 22:49:18.062456+00	3472	5	matin	303.00	318.20	5096.80	53	0	0.00	22.3	67.20	\N
2026-01-07 22:49:48.114898+00	3489	5	soir	312.10	310.00	5780.00	51	0	0.00	21.7	67.50	\N
2026-01-07 22:50:18.144526+00	3472	6	matin	341.80	341.80	5259.10	53	0	0.00	21.5	66.70	\N
2026-01-07 22:50:18.157187+00	3489	6	matin	305.10	311.40	5874.30	51	0	0.00	19.5	64.60	\N
2026-01-07 22:50:48.197102+00	3472	6	soir	362.30	362.70	5340.30	53	0	0.00	19.5	56.50	\N
2026-01-07 22:51:18.260956+00	3474	7	matin	335.00	340.00	6020.60	49	0	0.00	22.3	55.40	\N
2026-01-07 22:51:48.300436+00	3474	7	soir	375.40	360.80	6111.80	49	0	0.00	21.9	69.20	\N
2026-01-07 22:52:18.339045+00	3474	8	matin	353.90	360.00	6202.50	49	0	0.00	21.6	59.30	\N
2026-01-07 22:31:41.039278+00	3489	0	soir	218.30	210.00	4064.20	45	0	0.00	19.5	61.20	\N
2026-01-07 22:32:11.073205+00	3474	1	matin	222.70	223.60	4378.40	53	0	0.00	19.9	66.80	\N
2026-01-07 22:32:41.09866+00	3474	1	soir	239.50	235.50	4472.80	53	0	0.00	22.2	66.50	\N
2026-01-07 22:33:11.142594+00	3474	2	matin	255.30	247.30	4565.00	53	0	0.00	19.9	57.60	\N
2026-01-07 22:33:41.154829+00	3487	2	soir	268.40	256.70	5160.70	47	0	0.00	22.7	63.60	\N
2026-01-07 22:34:11.185769+00	3489	3	matin	273.50	270.90	4490.10	45	0	0.00	20.5	57.50	\N
2026-01-07 22:34:41.215659+00	3474	3	soir	289.90	286.40	4835.10	53	0	0.00	20.2	61.30	\N
2026-01-07 22:35:11.264785+00	3474	4	matin	283.50	294.50	4920.70	53	0	0.00	22.4	62.50	\N
2026-01-07 22:35:41.282629+00	3487	4	soir	309.30	303.30	5568.30	47	0	0.00	20.8	63.30	\N
2026-01-07 22:36:11.323734+00	3489	5	matin	323.40	318.20	4801.60	45	0	0.00	19.9	57.80	\N
2026-01-07 22:36:41.353466+00	3487	5	soir	310.70	326.70	5760.40	47	0	0.00	21.7	62.40	\N
2026-01-07 22:37:41.439065+00	3489	6	soir	368.10	362.70	5024.60	45	0	0.00	19.7	69.00	\N
2026-01-07 22:38:11.476227+00	3474	7	matin	377.10	365.50	5407.70	52	0	1.89	21.0	73.00	\N
2026-01-07 22:38:41.543209+00	3474	7	soir	391.50	388.20	5486.40	52	0	1.89	19.9	67.60	\N
2026-01-07 22:39:11.594311+00	3474	8	matin	371.10	389.10	5560.70	52	0	1.89	19.8	71.00	\N
2026-01-07 22:39:41.62937+00	3474	8	soir	407.10	413.60	5635.10	52	0	1.89	20.2	66.50	\N
2026-01-07 22:40:11.687+00	3474	9	matin	419.80	412.70	5708.00	51	0	3.77	22.8	72.70	\N
2026-01-07 22:40:41.727339+00	3474	9	soir	420.00	439.10	5779.50	51	0	3.77	21.1	58.20	\N
2026-01-07 22:41:11.774979+00	3474	10	matin	448.90	436.40	5847.50	51	0	3.77	21.6	70.40	\N
2026-01-07 22:41:41.813653+00	3487	10	soir	433.90	443.30	6633.40	47	0	0.00	21.7	62.90	\N
2026-01-07 22:42:11.846334+00	3489	11	matin	476.00	460.00	5618.90	45	0	0.00	21.0	63.70	\N
2026-01-07 22:42:41.876754+00	3487	11	soir	480.10	466.70	6789.80	47	0	0.00	19.8	63.60	\N
2026-01-07 22:44:17.715703+00	3489	0	matin	209.10	200.00	4611.70	51	0	0.00	19.3	73.40	\N
2026-01-07 22:44:47.721197+00	3474	0	soir	219.40	210.00	4708.80	49	0	0.00	19.3	57.70	\N
2026-01-07 22:45:17.761627+00	3474	1	matin	209.30	220.00	4817.90	49	0	0.00	19.2	69.60	\N
2026-01-07 22:45:47.799252+00	3474	1	soir	239.00	231.50	4927.70	49	0	0.00	22.8	59.50	\N
2026-01-07 22:46:17.848383+00	3474	2	matin	243.30	240.00	5035.50	49	0	0.00	21.1	61.90	\N
2026-01-07 22:46:47.873082+00	3474	2	soir	252.30	253.10	5138.10	49	0	0.00	22.6	56.80	\N
2026-01-07 22:47:17.904153+00	3474	3	matin	256.70	260.00	5240.90	49	0	0.00	21.0	72.20	\N
2026-01-07 22:47:47.925752+00	3474	3	soir	279.90	274.60	5342.00	49	0	0.00	20.9	56.40	\N
2026-01-07 22:48:17.97602+00	3474	4	matin	267.00	280.00	5441.60	49	0	0.00	21.9	59.80	\N
2026-01-07 22:48:48.035094+00	3474	4	soir	305.20	296.20	5540.40	49	0	0.00	19.7	56.30	\N
2026-01-07 22:49:18.068753+00	3474	5	matin	285.30	300.00	5640.40	49	0	0.00	20.2	61.80	\N
2026-01-07 22:49:48.111925+00	3474	5	soir	321.40	317.70	5735.50	49	0	0.00	19.9	65.00	\N
2026-01-07 22:50:18.151246+00	3474	6	matin	325.60	320.00	5833.40	49	0	0.00	22.3	55.70	\N
2026-01-07 22:50:48.2085+00	3474	6	soir	355.60	339.20	5930.00	49	0	0.00	20.8	58.60	\N
2026-01-07 22:51:18.257769+00	3472	7	matin	375.80	365.50	5414.90	53	0	0.00	19.1	62.20	\N
2026-01-07 22:51:48.308162+00	3489	7	soir	361.10	350.00	6164.00	51	0	0.00	21.1	61.20	\N
2026-01-07 22:52:18.333115+00	3472	8	matin	390.10	389.10	5565.80	53	0	0.00	19.6	58.10	\N
2026-01-07 22:52:48.360326+00	3472	8	soir	417.30	413.60	5640.10	53	0	0.00	19.5	62.30	\N
2026-01-07 22:52:48.374039+00	3489	8	soir	358.50	370.00	6346.40	51	0	0.00	20.9	69.40	\N
2026-01-07 22:53:18.407762+00	3472	9	matin	395.40	412.70	5711.50	53	0	0.00	19.8	57.60	\N
2026-01-07 22:53:48.447285+00	3489	9	soir	396.10	390.00	6522.90	51	0	0.00	21.5	62.10	\N
2026-01-07 22:54:18.478342+00	3472	10	matin	455.00	436.40	5850.40	53	0	0.00	19.2	62.10	\N
2026-01-07 22:54:48.508765+00	3489	10	soir	391.80	410.00	6691.40	51	0	0.00	22.6	66.20	\N
2026-01-07 22:55:18.512008+00	3472	11	matin	438.20	460.00	5982.00	53	0	0.00	20.7	64.10	\N
2026-01-07 22:55:48.552808+00	3489	11	soir	412.10	430.00	6857.60	51	0	0.00	22.0	62.80	\N
2026-01-07 22:56:18.571591+00	3489	12	matin	405.90	422.90	6939.00	51	0	0.00	21.3	69.80	\N
2026-01-07 22:56:48.583485+00	3474	12	soir	487.20	468.50	6947.50	47	0	4.08	21.5	64.20	\N
2026-01-07 22:57:18.637454+00	3489	13	matin	447.40	441.40	7096.10	51	0	0.00	20.9	57.30	\N
2026-01-07 22:57:48.65886+00	3474	13	soir	501.50	490.00	7098.50	47	0	4.08	19.6	60.80	\N
2026-01-07 22:59:24.386512+00	3488	0	matin	205.20	200.00	4198.30	54	0	0.00	19.4	65.90	\N
2026-01-07 22:59:54.39927+00	3488	0	soir	200.10	210.00	4295.60	54	0	0.00	19.2	59.10	\N
2026-01-07 23:00:24.446578+00	3488	1	matin	223.20	220.00	4392.80	54	0	0.00	22.0	64.50	\N
2026-01-07 23:00:54.493482+00	3488	1	soir	233.00	231.50	4487.50	54	0	0.00	21.6	74.80	\N
2026-01-07 23:01:24.545448+00	3488	2	matin	232.30	240.00	4582.70	53	0	1.85	20.2	75.00	\N
2026-01-07 23:01:54.581019+00	3658	2	soir	262.90	253.10	5155.90	46	0	0.00	20.7	70.20	\N
2026-01-07 23:01:54.595299+00	3489	2	soir	248.40	250.00	4427.00	52	0	0.00	22.2	63.90	\N
2026-01-07 23:02:24.627053+00	3658	3	matin	261.40	260.00	5258.80	46	0	0.00	21.7	67.60	\N
2026-01-07 23:03:24.750793+00	3489	4	matin	285.10	274.30	4671.90	52	0	0.00	19.8	65.70	\N
2026-01-07 23:03:54.779978+00	3658	4	soir	283.60	296.20	5563.20	46	0	0.00	20.1	72.30	\N
2026-01-07 23:03:54.792123+00	3489	4	soir	300.70	290.00	4752.00	52	0	0.00	22.7	74.90	\N
2026-01-07 23:04:24.829593+00	3658	5	matin	285.70	300.00	5659.60	46	0	0.00	20.7	71.80	\N
2026-01-07 23:04:54.874505+00	3489	5	soir	311.20	310.00	4908.20	52	0	0.00	20.9	71.60	\N
2026-01-07 23:05:24.909235+00	3488	6	matin	325.50	320.00	5280.60	53	0	1.85	19.7	62.30	\N
2026-01-07 23:05:54.949583+00	3488	6	soir	344.90	339.20	5362.60	53	0	1.85	21.7	67.90	\N
2026-01-07 23:06:25.00573+00	3488	7	matin	335.00	340.00	5444.50	53	0	1.85	22.1	59.10	\N
2026-01-07 23:06:55.049938+00	3488	7	soir	345.40	360.80	5526.80	53	0	1.85	22.0	62.20	\N
2026-01-07 23:06:55.05347+00	3489	7	soir	357.20	350.00	5211.20	52	0	0.00	22.7	59.20	\N
2026-01-07 23:07:25.094261+00	3658	8	matin	356.40	360.00	6219.20	46	0	0.00	21.4	57.60	\N
2026-01-07 23:08:25.208641+00	3489	9	matin	371.40	367.10	5427.90	52	0	0.00	20.2	60.50	\N
2026-01-07 23:08:55.242937+00	3658	9	soir	397.50	403.80	6477.50	46	0	0.00	19.7	67.00	\N
2026-01-07 23:08:55.258569+00	3489	9	soir	396.80	390.00	5497.80	52	0	0.00	19.7	64.00	\N
2026-01-07 23:09:25.315475+00	3658	10	matin	394.30	400.00	6560.40	46	0	0.00	20.4	63.70	\N
2026-01-07 23:09:25.329311+00	3489	10	matin	394.60	385.70	5567.00	52	0	0.00	22.9	71.00	\N
2026-01-07 23:09:55.371877+00	3658	10	soir	445.40	425.40	6642.50	45	0	2.17	21.5	69.10	\N
2026-01-07 23:10:25.432379+00	3489	11	matin	414.00	404.30	5699.20	52	0	0.00	21.9	57.40	\N
2026-01-07 23:10:55.469509+00	3658	11	soir	437.30	446.90	6804.60	45	0	2.17	19.4	64.00	\N
2026-01-07 23:11:55.560728+00	3489	12	soir	470.70	450.00	5893.80	52	0	0.00	21.4	67.90	\N
2026-01-07 23:12:25.594391+00	3658	13	matin	450.00	460.00	7038.10	45	0	2.17	19.0	63.70	\N
2026-01-07 23:12:55.648329+00	3489	13	soir	485.50	470.00	6021.50	51	0	1.92	21.2	65.90	\N
2026-01-07 23:13:25.683931+00	3489	14	matin	439.10	460.00	6082.90	51	0	1.92	22.9	65.50	\N
2026-01-07 23:13:55.712077+00	3489	14	soir	505.80	490.00	6144.40	51	0	1.92	21.0	62.60	\N
2026-01-07 23:14:31.32995+00	3472	0	matin	195.30	200.00	4614.60	53	0	0.00	22.1	59.10	\N
2026-01-07 23:15:01.454427+00	3489	0	soir	214.80	210.00	4075.70	48	0	0.00	20.3	58.00	\N
2026-01-07 23:15:31.472022+00	3488	1	matin	219.50	221.70	4829.30	45	0	0.00	20.0	65.50	\N
2026-01-07 23:16:01.509375+00	3488	1	soir	241.10	233.30	4941.30	45	0	0.00	19.3	58.30	\N
2026-01-07 23:16:31.545973+00	3472	2	matin	255.30	243.30	5049.40	53	0	0.00	21.1	72.40	\N
2026-01-07 23:17:01.604479+00	3489	2	soir	250.80	260.90	4416.70	48	0	0.00	22.9	74.20	\N
2026-01-07 22:52:48.369669+00	3474	8	soir	383.90	382.30	6292.90	49	0	0.00	19.9	72.80	\N
2026-01-07 22:53:18.414073+00	3474	9	matin	396.70	380.00	6377.40	49	0	0.00	19.5	61.20	\N
2026-01-07 22:53:48.441507+00	3474	9	soir	404.30	403.80	6463.20	49	0	0.00	19.9	72.20	\N
2026-01-07 22:54:18.484694+00	3474	10	matin	396.90	400.00	6546.50	49	0	0.00	19.3	59.60	\N
2026-01-07 22:54:48.501984+00	3474	10	soir	413.30	425.40	6631.80	49	0	0.00	20.5	67.80	\N
2026-01-07 22:55:18.519474+00	3474	11	matin	418.20	420.00	6710.10	49	0	0.00	20.8	72.50	\N
2026-01-07 22:55:48.547235+00	3474	11	soir	464.00	446.90	6793.50	48	0	2.04	19.9	66.40	\N
2026-01-07 22:59:24.388944+00	3489	0	matin	207.40	200.00	3991.40	52	0	0.00	20.2	74.80	\N
2026-01-07 22:59:54.392077+00	3658	0	soir	200.30	210.00	4724.20	46	0	0.00	22.4	74.60	\N
2026-01-07 23:01:24.550789+00	3489	2	matin	245.30	237.10	4341.70	52	0	0.00	22.7	60.60	\N
2026-01-07 23:01:54.587644+00	3488	2	soir	248.00	253.10	4673.70	53	0	1.85	20.5	63.80	\N
2026-01-07 23:02:24.629921+00	3488	3	matin	258.10	260.00	4761.20	53	0	1.85	19.7	64.80	\N
2026-01-07 23:02:54.662014+00	3658	3	soir	285.90	274.60	5362.70	46	0	0.00	20.0	74.90	\N
2026-01-07 23:02:54.678486+00	3489	3	soir	283.50	270.00	4590.80	52	0	0.00	21.9	66.70	\N
2026-01-07 23:03:24.737314+00	3658	4	matin	268.20	280.00	5461.70	46	0	0.00	21.3	61.10	\N
2026-01-07 23:04:24.844415+00	3489	5	matin	291.00	292.90	4830.40	52	0	0.00	22.8	59.60	\N
2026-01-07 23:04:54.857486+00	3658	5	soir	329.40	317.70	5757.70	46	0	0.00	22.7	57.60	\N
2026-01-07 23:05:24.911608+00	3489	6	matin	301.60	311.40	4984.00	52	0	0.00	22.7	71.10	\N
2026-01-07 23:05:54.941528+00	3658	6	soir	338.70	339.20	5947.10	46	0	0.00	22.0	65.50	\N
2026-01-07 23:05:54.957895+00	3489	6	soir	346.40	330.00	5061.10	52	0	0.00	21.3	66.00	\N
2026-01-07 23:06:24.997371+00	3658	7	matin	354.20	340.00	6039.80	46	0	0.00	22.8	68.90	\N
2026-01-07 23:06:25.013352+00	3489	7	matin	320.30	330.00	5135.80	52	0	0.00	21.1	67.30	\N
2026-01-07 23:06:55.040759+00	3658	7	soir	375.60	360.80	6130.60	46	0	0.00	19.6	61.80	\N
2026-01-07 23:07:25.102671+00	3488	8	matin	372.10	360.00	5605.10	53	0	1.85	19.3	60.00	\N
2026-01-07 23:07:55.131332+00	3488	8	soir	366.20	382.30	5682.70	53	0	1.85	19.4	63.10	\N
2026-01-07 23:07:55.138664+00	3489	8	soir	380.50	370.00	5358.60	52	0	0.00	19.7	59.40	\N
2026-01-07 23:08:25.194669+00	3658	9	matin	387.00	380.00	6393.60	46	0	0.00	20.8	63.90	\N
2026-01-07 23:09:55.383358+00	3489	10	soir	405.10	410.00	5633.20	52	0	0.00	22.5	56.10	\N
2026-01-07 23:10:25.417972+00	3658	11	matin	413.10	420.00	6724.40	45	0	2.17	22.2	74.20	\N
2026-01-07 23:10:55.483671+00	3489	11	soir	437.70	430.00	5765.50	52	0	0.00	19.1	69.40	\N
2026-01-07 23:11:25.493547+00	3658	12	matin	458.90	440.00	6883.50	45	0	2.17	20.4	68.90	\N
2026-01-07 23:11:25.511524+00	3489	12	matin	441.80	422.90	5830.30	52	0	0.00	19.2	68.40	\N
2026-01-07 23:11:55.548159+00	3658	12	soir	486.30	468.50	6962.70	45	0	2.17	22.9	74.80	\N
2026-01-07 23:12:25.605356+00	3489	13	matin	460.90	441.40	5955.30	52	0	0.00	21.0	62.60	\N
2026-01-07 23:12:55.635213+00	3658	13	soir	491.20	490.00	7112.50	45	0	2.17	19.8	73.80	\N
2026-01-07 23:14:31.416086+00	3489	0	matin	198.40	200.00	3984.30	48	0	0.00	20.4	57.30	\N
2026-01-07 23:15:01.451482+00	3488	0	soir	201.30	210.00	4719.20	45	0	0.00	20.5	69.50	\N
2026-01-07 23:15:31.463797+00	3472	1	matin	219.70	221.70	4833.30	53	0	0.00	20.7	66.30	\N
2026-01-07 23:16:01.51375+00	3489	1	soir	227.40	235.50	4250.90	48	0	0.00	21.8	60.20	\N
2026-01-07 23:16:31.553629+00	3488	2	matin	232.60	243.30	5045.50	45	0	0.00	21.0	73.60	\N
2026-01-07 23:17:01.592699+00	3472	2	soir	264.50	256.70	5156.10	53	0	0.00	21.0	73.60	\N
2026-01-07 22:53:18.417821+00	3489	9	matin	361.80	367.10	6435.70	51	0	0.00	21.9	72.50	\N
2026-01-07 22:53:48.434705+00	3472	9	soir	457.10	439.10	5782.00	53	0	0.00	20.1	72.60	\N
2026-01-07 22:54:18.489224+00	3489	10	matin	387.00	385.70	6605.70	51	0	0.00	19.9	56.80	\N
2026-01-07 22:54:48.493679+00	3472	10	soir	473.50	464.50	5918.10	53	0	0.00	22.9	73.40	\N
2026-01-07 22:55:18.526515+00	3489	11	matin	390.00	404.30	6774.70	51	0	0.00	20.1	64.60	\N
2026-01-07 22:55:48.538423+00	3472	11	soir	498.80	490.00	6048.30	53	0	0.00	19.5	70.00	\N
2026-01-07 22:56:18.563848+00	3474	12	matin	423.10	440.00	6870.30	47	0	4.08	19.9	63.60	\N
2026-01-07 22:56:48.591624+00	3489	12	soir	437.40	450.00	7020.20	51	0	0.00	22.0	66.50	\N
2026-01-07 22:57:18.629326+00	3474	13	matin	466.60	460.00	7023.00	47	0	4.08	22.4	69.30	\N
2026-01-07 22:57:48.66588+00	3489	13	soir	469.00	470.00	7173.10	51	0	0.00	22.7	72.00	\N
2026-01-07 22:58:18.690012+00	3489	14	matin	450.80	460.00	7247.30	51	0	0.00	21.3	66.70	\N
2026-01-07 22:58:48.720707+00	3489	14	soir	513.10	490.00	7321.50	51	0	0.00	19.6	60.50	\N
2026-01-07 22:59:24.305493+00	3658	0	matin	198.00	200.00	4611.50	46	0	0.00	20.8	68.90	\N
2026-01-07 22:59:54.405443+00	3489	0	soir	200.40	210.00	4082.60	52	0	0.00	19.7	61.00	\N
2026-01-07 23:00:24.438058+00	3658	1	matin	211.60	220.00	4832.20	46	0	0.00	19.5	68.80	\N
2026-01-07 23:00:24.455416+00	3489	1	matin	215.20	218.60	4167.80	52	0	0.00	21.4	70.90	\N
2026-01-07 23:00:54.484771+00	3658	1	soir	225.70	231.50	4943.10	46	0	0.00	22.0	73.10	\N
2026-01-07 23:00:54.501069+00	3489	1	soir	229.80	230.00	4256.60	52	0	0.00	19.2	74.00	\N
2026-01-07 23:01:24.538233+00	3658	2	matin	232.10	240.00	5048.00	46	0	0.00	19.8	61.30	\N
2026-01-07 23:02:24.632125+00	3489	3	matin	244.40	255.70	4508.60	52	0	0.00	21.4	70.30	\N
2026-01-07 23:02:54.670486+00	3488	3	soir	270.00	274.60	4851.60	53	0	1.85	22.8	70.60	\N
2026-01-07 23:03:24.745574+00	3488	4	matin	276.70	280.00	4938.70	53	0	1.85	22.3	61.30	\N
2026-01-07 23:03:54.78523+00	3488	4	soir	303.50	296.20	5027.20	53	0	1.85	19.2	71.80	\N
2026-01-07 23:04:24.837427+00	3488	5	matin	297.70	300.00	5112.50	53	0	1.85	20.5	71.80	\N
2026-01-07 23:04:54.867769+00	3488	5	soir	304.40	317.70	5197.10	53	0	1.85	22.3	72.30	\N
2026-01-07 23:05:24.906217+00	3658	6	matin	312.10	320.00	5853.60	46	0	0.00	21.4	65.20	\N
2026-01-07 23:07:25.110728+00	3489	8	matin	354.90	348.60	5284.60	52	0	0.00	19.8	67.20	\N
2026-01-07 23:07:55.124154+00	3658	8	soir	365.00	382.30	6308.70	46	0	0.00	19.7	73.30	\N
2026-01-07 23:08:25.201139+00	3488	9	matin	398.30	380.00	5756.80	53	0	1.85	20.3	60.50	\N
2026-01-07 23:08:55.250247+00	3488	9	soir	404.50	403.80	5831.80	53	0	1.85	20.1	58.50	\N
2026-01-07 23:09:25.32324+00	3488	10	matin	402.50	400.00	5903.60	53	0	1.85	22.5	57.60	\N
2026-01-07 23:09:55.378727+00	3488	10	soir	439.40	425.40	5976.80	53	0	1.85	20.1	64.90	\N
2026-01-07 23:10:25.424453+00	3488	11	matin	404.00	420.00	6047.80	53	0	1.85	19.0	72.90	\N
2026-01-07 23:10:55.477257+00	3488	11	soir	461.60	446.90	6120.40	53	0	1.85	20.8	61.60	\N
2026-01-07 23:11:25.50187+00	3488	12	matin	459.10	440.00	6187.80	53	0	1.85	20.0	65.80	\N
2026-01-07 23:11:55.555294+00	3488	12	soir	468.60	468.50	6254.60	53	0	1.85	22.6	62.50	\N
2026-01-07 23:12:25.597767+00	3488	13	matin	447.10	460.00	6318.10	53	0	1.85	21.8	61.70	\N
2026-01-07 23:12:55.642444+00	3488	13	soir	471.10	490.00	6382.10	53	0	1.85	20.2	66.50	\N
2026-01-07 23:14:31.41392+00	3488	0	matin	209.90	200.00	4604.20	45	0	0.00	20.3	57.00	\N
2026-01-07 23:15:01.447151+00	3472	0	soir	218.60	210.00	4724.70	53	0	0.00	19.2	68.00	\N
2026-01-07 23:15:31.47881+00	3489	1	matin	232.70	223.60	4164.00	48	0	0.00	22.1	58.10	\N
2026-01-07 23:16:01.503648+00	3472	1	soir	227.70	233.30	4941.40	53	0	0.00	21.5	67.10	\N
2026-01-07 23:16:31.558691+00	3489	2	matin	236.50	247.30	4335.70	48	0	0.00	21.9	74.90	\N
2026-01-07 23:17:01.598961+00	3488	2	soir	256.20	256.70	5150.90	45	0	0.00	22.5	67.50	\N
2026-01-07 23:17:31.635336+00	3472	3	matin	274.80	265.00	5259.70	53	0	0.00	21.6	73.60	\N
2026-01-07 23:18:01.696711+00	3489	3	soir	280.50	286.40	4583.40	48	0	0.00	19.6	73.30	\N
2026-01-07 23:18:31.719215+00	3472	4	matin	300.70	286.70	5461.50	53	0	0.00	19.1	73.80	\N
2026-01-07 23:20:31.877303+00	3489	6	matin	332.00	341.80	4970.70	47	0	2.08	22.4	55.40	\N
2026-01-07 23:21:01.883949+00	3472	6	soir	362.70	350.00	5935.10	53	0	0.00	19.8	66.80	\N
2026-01-07 23:21:31.927747+00	3489	7	matin	348.40	365.50	5114.70	47	0	2.08	19.1	64.80	\N
2026-01-07 23:22:01.937841+00	3472	7	soir	379.90	373.30	6117.50	53	0	0.00	20.4	68.50	\N
2026-01-07 23:22:31.986106+00	3489	8	matin	386.90	389.10	5257.20	45	0	6.25	23.0	56.00	\N
2026-01-07 23:23:02.018697+00	3472	8	soir	382.00	396.70	6291.80	53	0	0.00	21.0	57.90	\N
2026-01-07 23:24:02.098976+00	3489	9	soir	418.90	439.10	5454.10	45	0	6.25	21.3	60.90	\N
2026-01-07 23:24:32.114107+00	3488	10	matin	432.40	416.70	6537.70	45	0	0.00	20.6	60.90	\N
2026-01-07 23:25:02.127075+00	3472	10	soir	448.90	443.30	6617.20	53	0	0.00	20.3	65.50	\N
2026-01-07 23:25:32.155047+00	3489	11	matin	443.80	460.00	5639.20	45	0	6.25	22.1	66.40	\N
2026-01-07 23:26:02.186222+00	3472	11	soir	451.50	466.70	6774.60	53	0	0.00	21.1	56.40	\N
2026-01-07 23:26:02.205634+00	3489	11	soir	513.50	490.00	5699.20	43	0	10.42	20.3	62.90	\N
2026-01-07 23:26:32.259147+00	3472	12	matin	456.30	460.00	6850.50	53	0	0.00	20.6	73.80	\N
2026-01-07 23:27:02.278284+00	3488	12	soir	493.90	490.00	6923.10	45	0	0.00	19.4	65.00	\N
2026-01-07 23:17:31.64447+00	3488	3	matin	269.50	265.00	5254.20	45	0	0.00	20.3	60.20	\N
2026-01-07 23:18:01.682177+00	3472	3	soir	288.30	280.00	5361.90	53	0	0.00	20.5	58.10	\N
2026-01-07 23:18:31.72487+00	3489	4	matin	294.60	294.50	4663.30	48	0	0.00	22.6	59.20	\N
2026-01-07 23:19:01.739776+00	3472	4	soir	294.30	303.30	5559.50	53	0	0.00	21.5	55.70	\N
2026-01-07 23:19:01.752755+00	3489	4	soir	307.60	311.80	4740.00	47	0	2.08	22.0	69.90	\N
2026-01-07 23:19:31.78396+00	3472	5	matin	309.10	308.30	5656.10	53	0	0.00	20.8	64.60	\N
2026-01-07 23:19:31.799957+00	3489	5	matin	314.70	318.20	4818.50	47	0	2.08	21.1	59.50	\N
2026-01-07 23:20:01.822104+00	3472	5	soir	329.30	326.70	5750.80	53	0	0.00	23.0	66.10	\N
2026-01-07 23:20:01.830965+00	3489	5	soir	342.60	337.30	4896.80	47	0	2.08	21.6	55.60	\N
2026-01-07 23:20:31.863301+00	3472	6	matin	322.10	330.00	5843.80	53	0	0.00	19.5	72.40	\N
2026-01-07 23:21:01.892297+00	3489	6	soir	377.10	362.70	5044.70	47	0	2.08	22.9	73.60	\N
2026-01-07 23:21:31.913229+00	3472	7	matin	345.30	351.70	6026.20	53	0	0.00	21.3	58.50	\N
2026-01-07 23:22:01.951263+00	3489	7	soir	385.30	388.20	5185.90	47	0	2.08	20.8	56.90	\N
2026-01-07 23:22:31.970623+00	3472	8	matin	382.80	373.30	6205.10	53	0	0.00	22.5	62.10	\N
2026-01-07 23:23:02.031848+00	3489	8	soir	400.70	413.60	5325.60	45	0	6.25	22.8	63.00	\N
2026-01-07 23:23:32.039988+00	3472	9	matin	410.70	395.00	6374.50	53	0	0.00	21.3	63.80	\N
2026-01-07 23:23:32.057011+00	3489	9	matin	427.30	412.70	5389.40	45	0	6.25	20.5	62.00	\N
2026-01-07 23:24:02.09315+00	3472	9	soir	431.40	420.00	6457.90	53	0	0.00	21.5	56.40	\N
2026-01-07 23:24:32.117241+00	3489	10	matin	429.60	436.40	5515.40	45	0	6.25	21.3	74.00	\N
2026-01-07 23:25:02.131269+00	3488	10	soir	437.90	443.30	6619.10	45	0	0.00	23.0	55.70	\N
2026-01-07 23:25:32.151284+00	3488	11	matin	430.10	438.30	6695.80	45	0	0.00	20.7	66.40	\N
2026-01-07 23:26:02.196024+00	3488	11	soir	460.70	466.70	6774.50	45	0	0.00	21.0	70.20	\N
2026-01-07 23:26:32.262858+00	3488	12	matin	462.50	460.00	6849.60	45	0	0.00	22.5	57.30	\N
2026-01-07 23:27:02.271978+00	3472	12	soir	504.20	490.00	6927.30	53	0	0.00	22.4	67.90	\N
2026-01-07 21:13:30.695862+00	3488	10	matin	380.60	385.70	5938.80	45	0	0.00	20.2	61.00	\N
2026-01-07 21:14:00.704555+00	3488	10	soir	405.00	410.00	6013.10	45	0	0.00	23.0	59.10	\N
2026-01-07 21:14:30.748532+00	3488	11	matin	420.40	404.30	6084.20	45	0	0.00	22.4	61.60	\N
2026-01-07 21:15:00.771017+00	3488	11	soir	417.50	430.00	6155.90	45	0	0.00	19.5	59.70	\N
2026-01-07 21:15:30.797264+00	3488	12	matin	443.90	422.90	6226.10	45	0	0.00	21.2	68.70	\N
2026-01-07 21:16:01.02237+00	3488	12	soir	431.50	450.00	6296.60	45	0	0.00	22.2	62.70	\N
2026-01-07 21:16:31.041242+00	3488	13	matin	439.20	441.40	6363.90	45	0	0.00	21.7	63.80	\N
2026-01-07 21:17:01.093065+00	3488	13	soir	462.20	470.00	6429.90	45	0	0.00	19.0	62.20	\N
2026-01-07 21:17:31.147933+00	3488	14	matin	471.60	460.00	6495.80	45	0	0.00	21.9	57.60	\N
2026-01-07 21:18:01.204932+00	3488	14	soir	509.90	490.00	6561.50	45	0	0.00	21.7	71.00	\N
2026-01-07 21:18:36.896697+00	3474	0	matin	193.30	200.00	3991.70	48	0	0.00	20.5	55.10	\N
2026-01-07 21:19:06.904285+00	3474	0	soir	219.40	210.00	4082.00	48	0	0.00	20.4	58.70	\N
2026-01-07 21:19:36.938093+00	3472	1	matin	212.00	221.70	4813.40	48	0	0.00	20.7	68.50	\N
2026-01-07 21:20:06.985253+00	3473	1	soir	238.50	233.30	4953.20	52	0	0.00	22.7	62.50	\N
2026-01-07 21:20:36.996859+00	3472	2	matin	242.90	243.30	5031.60	48	0	0.00	21.0	66.20	\N
2026-01-07 21:21:07.052708+00	3473	2	soir	246.00	256.70	5158.60	52	0	0.00	19.3	61.10	\N
2026-01-07 21:21:37.089776+00	3472	3	matin	258.80	265.00	5238.10	48	0	0.00	22.7	55.10	\N
2026-01-07 21:22:37.212598+00	3473	4	matin	279.00	286.70	5462.80	52	0	0.00	20.4	64.80	\N
2026-01-07 21:23:07.224164+00	3474	4	soir	297.20	311.80	4744.00	47	0	2.08	20.1	55.40	\N
2026-01-07 21:23:37.2615+00	3474	5	matin	329.20	318.20	4822.70	47	0	2.08	22.3	74.40	\N
2026-01-07 21:24:07.306646+00	3474	5	soir	336.40	337.30	4900.30	47	0	2.08	21.8	74.30	\N
2026-01-07 21:24:07.311964+00	3473	5	soir	329.20	326.70	5760.10	51	0	1.92	22.8	58.50	\N
2026-01-07 21:24:37.35651+00	3472	6	matin	328.90	330.00	5837.30	48	0	0.00	20.7	67.90	\N
\.


--
-- Data for Name: _hyper_24_220_chunk; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._hyper_24_220_chunk ("time", lot_gavage_id, jour_gavage, repas, dose_moyenne, dose_theorique, poids_moyen_lot, nb_canards_vivants, nb_canards_morts, taux_mortalite, temperature_stabule, humidite_stabule, remarques) FROM stdin;
2026-01-08 08:13:05.061155+00	3474	0	soir	218.10	210.00	4714.30	46	0	0.00	22.0	56.80	\N
2026-01-08 08:13:04.926787+00	3472	0	soir	215.30	210.00	4729.20	45	0	0.00	21.4	57.60	\N
2026-01-08 08:13:05.066403+00	4516	0	soir	217.70	210.00	4734.60	48	0	0.00	20.0	71.60	\N
2026-01-08 08:13:35.0974+00	3472	1	matin	214.20	223.60	4839.00	45	0	0.00	19.5	65.10	\N
2026-01-08 08:13:35.104728+00	3474	1	matin	209.40	220.00	4823.80	46	0	0.00	22.5	55.50	\N
2026-01-08 08:13:35.109538+00	4516	1	matin	218.10	221.70	4843.90	48	0	0.00	19.2	56.50	\N
2026-01-08 08:14:05.138102+00	3472	1	soir	234.60	235.50	4946.10	45	0	0.00	20.4	55.60	\N
2026-01-08 08:14:05.150186+00	3474	1	soir	237.80	231.50	4932.60	46	0	0.00	21.4	73.60	\N
2026-01-08 08:14:05.158274+00	4516	1	soir	225.60	233.30	4952.40	48	0	0.00	21.0	56.80	\N
2026-01-08 08:14:35.186978+00	3472	2	matin	254.60	247.30	5051.50	45	0	0.00	21.1	73.90	\N
2026-01-08 08:14:35.196031+00	3474	2	matin	236.70	240.00	5036.40	46	0	0.00	22.3	62.50	\N
2026-01-08 08:14:35.1994+00	4516	2	matin	240.50	243.30	5058.20	48	0	0.00	20.5	62.20	\N
2026-01-08 08:15:05.202686+00	3472	2	soir	269.00	260.90	5159.70	45	0	0.00	19.7	58.80	\N
2026-01-08 08:15:05.207245+00	3474	2	soir	252.40	253.10	5142.20	46	0	0.00	22.2	74.40	\N
2026-01-08 08:15:05.211982+00	4516	2	soir	268.10	256.70	5162.80	48	0	0.00	20.8	64.30	\N
2026-01-08 08:15:35.249009+00	3472	3	matin	269.80	270.90	5260.70	45	0	0.00	20.9	58.60	\N
2026-01-08 08:15:35.253392+00	3474	3	matin	255.70	260.00	5247.00	46	0	0.00	21.7	56.20	\N
2026-01-08 08:15:35.256833+00	4516	3	matin	261.50	265.00	5264.50	48	0	0.00	19.5	73.40	\N
2026-01-08 08:16:05.290631+00	3472	3	soir	293.40	286.40	5365.30	45	0	0.00	22.2	55.60	\N
2026-01-08 08:16:05.296725+00	3474	3	soir	263.20	274.60	5348.80	46	0	0.00	21.7	66.30	\N
2026-01-08 08:16:05.303793+00	4516	3	soir	283.30	280.00	5367.90	48	0	0.00	23.0	68.60	\N
2026-01-08 08:16:35.318638+00	3472	4	matin	287.20	294.50	5465.00	45	0	0.00	21.6	71.30	\N
2026-01-08 08:16:35.323854+00	3474	4	matin	278.30	280.00	5451.30	46	0	0.00	21.4	70.60	\N
2026-01-08 08:16:35.327419+00	4516	4	matin	283.30	286.70	5470.40	48	0	0.00	21.3	67.20	\N
2026-01-08 08:17:05.370015+00	3472	4	soir	320.60	311.80	5565.60	45	0	0.00	20.9	58.10	\N
2026-01-08 08:17:05.375983+00	3474	4	soir	289.70	296.20	5553.40	46	0	0.00	20.7	56.00	\N
2026-01-08 08:17:05.386533+00	4516	4	soir	316.20	303.30	5569.20	48	0	0.00	20.4	67.40	\N
2026-01-08 08:17:35.42893+00	3472	5	matin	333.70	318.20	5661.80	45	0	0.00	19.8	62.20	\N
2026-01-08 08:17:35.433489+00	3474	5	matin	308.90	300.00	5652.20	46	0	0.00	20.8	70.20	\N
2026-01-08 08:17:35.437222+00	4516	5	matin	313.70	308.30	5666.00	48	0	0.00	22.7	56.20	\N
2026-01-08 08:18:05.477621+00	3472	5	soir	325.90	337.30	5762.90	44	0	2.22	22.1	66.30	\N
2026-01-08 08:18:05.484687+00	3474	5	soir	327.80	317.70	5748.90	46	0	0.00	22.0	74.60	\N
2026-01-08 08:18:05.490516+00	4516	5	soir	325.70	326.70	5764.90	48	0	0.00	22.7	60.70	\N
2026-01-08 08:18:35.523669+00	3472	6	matin	341.50	341.80	5853.60	44	0	2.22	19.6	70.00	\N
2026-01-08 08:18:35.530694+00	3474	6	matin	311.70	320.00	5843.00	46	0	0.00	19.5	57.80	\N
2026-01-08 08:18:35.539251+00	4516	6	matin	337.70	330.00	5860.00	48	0	0.00	19.1	67.00	\N
2026-01-08 08:19:05.589839+00	3472	6	soir	346.00	362.70	5943.70	43	0	4.44	20.3	57.70	\N
2026-01-08 08:19:05.59627+00	3474	6	soir	325.20	339.20	5936.10	46	0	0.00	19.6	67.00	\N
2026-01-08 08:19:05.602885+00	4516	6	soir	346.60	350.00	5952.30	48	0	0.00	21.8	72.20	\N
2026-01-08 08:19:35.647978+00	3472	7	matin	352.70	365.50	6031.60	43	0	4.44	20.6	56.40	\N
2026-01-08 08:19:35.655093+00	3474	7	matin	349.90	340.00	6029.90	46	0	0.00	22.7	64.50	\N
2026-01-08 08:19:35.662244+00	4516	7	matin	349.70	351.70	6045.00	48	0	0.00	20.6	60.10	\N
2026-01-08 08:20:05.697914+00	3472	7	soir	386.90	388.20	6119.80	43	0	4.44	22.4	65.80	\N
2026-01-08 08:20:05.703087+00	3474	7	soir	344.20	360.80	6126.40	46	0	0.00	20.5	56.70	\N
2026-01-08 08:20:05.706879+00	4516	7	soir	384.60	373.30	6133.90	48	0	0.00	19.9	60.80	\N
2026-01-08 08:20:35.727622+00	3472	8	matin	381.20	389.10	6203.10	43	0	4.44	20.0	61.20	\N
2026-01-08 08:20:35.733462+00	3474	8	matin	343.30	360.00	6212.80	46	0	0.00	22.0	73.50	\N
2026-01-08 08:20:35.736232+00	4516	8	matin	360.00	373.30	6222.60	48	0	0.00	20.3	73.80	\N
2026-01-08 08:21:05.77764+00	3472	8	soir	421.90	413.60	6285.70	43	0	4.44	20.3	63.20	\N
2026-01-08 08:21:05.783733+00	3474	8	soir	381.50	382.30	6299.80	46	0	0.00	20.8	68.70	\N
2026-01-08 08:21:05.788074+00	4516	8	soir	390.50	396.70	6311.70	48	0	0.00	21.9	55.30	\N
2026-01-08 08:21:35.829132+00	3472	9	matin	426.20	412.70	6368.60	43	0	4.44	22.4	61.00	\N
2026-01-08 08:21:35.835004+00	3474	9	matin	391.50	380.00	6387.40	46	0	0.00	19.3	65.00	\N
2026-01-08 08:21:35.840375+00	4516	9	matin	408.60	395.00	6398.20	48	0	0.00	21.4	73.10	\N
2026-01-08 08:22:05.852101+00	3472	9	soir	436.20	439.10	6449.10	43	0	4.44	22.1	62.70	\N
2026-01-08 08:22:05.858289+00	3474	9	soir	404.10	403.80	6473.80	46	0	0.00	21.4	67.60	\N
2026-01-08 08:22:05.866825+00	4516	9	soir	422.90	420.00	6483.10	48	0	0.00	21.5	67.10	\N
2026-01-08 08:22:35.914177+00	3472	10	matin	427.80	436.40	6526.70	43	0	4.44	21.6	68.80	\N
2026-01-08 08:22:35.921624+00	3474	10	matin	382.80	400.00	6558.10	46	0	0.00	20.2	61.70	\N
2026-01-08 08:22:35.927785+00	4516	10	matin	405.80	416.70	6565.30	48	0	0.00	19.8	56.70	\N
2026-01-08 08:23:05.960299+00	3472	10	soir	461.90	464.50	6606.50	43	0	4.44	19.5	64.70	\N
2026-01-08 08:23:05.966039+00	3474	10	soir	420.80	425.40	6642.00	46	0	0.00	20.5	57.50	\N
2026-01-08 08:23:05.969149+00	4516	10	soir	442.70	443.30	6650.50	48	0	0.00	20.8	73.00	\N
2026-01-08 08:23:35.976736+00	3472	11	matin	448.70	460.00	6683.30	43	0	4.44	19.9	61.00	\N
2026-01-08 08:23:35.981093+00	3474	11	matin	421.30	420.00	6724.20	46	0	0.00	21.4	69.20	\N
2026-01-08 08:23:35.985585+00	4516	11	matin	439.30	438.30	6728.10	48	0	0.00	19.1	58.00	\N
2026-01-08 08:24:06.025028+00	3472	11	soir	494.30	490.00	6755.60	43	0	4.44	19.0	67.80	\N
2026-01-08 08:24:06.029879+00	3474	11	soir	453.10	446.90	6807.50	46	0	0.00	22.7	56.70	\N
2026-01-08 08:24:06.032545+00	4516	11	soir	467.40	466.70	6807.00	48	0	0.00	22.2	68.20	\N
2026-01-08 08:24:36.070908+00	3474	12	matin	428.60	440.00	6885.30	46	0	0.00	20.9	68.50	\N
2026-01-08 08:24:36.076142+00	4516	12	matin	468.50	460.00	6883.30	48	0	0.00	21.8	55.30	\N
2026-01-08 08:25:06.103112+00	3474	12	soir	491.30	468.50	6962.40	46	0	0.00	22.1	66.90	\N
2026-01-08 08:25:06.110689+00	4516	12	soir	485.50	490.00	6958.30	48	0	0.00	21.2	64.20	\N
2026-01-08 08:25:36.1463+00	3474	13	matin	463.00	460.00	7038.80	46	0	0.00	19.3	58.80	\N
2026-01-08 08:26:06.177617+00	3474	13	soir	475.80	490.00	7114.10	46	0	0.00	20.6	61.00	\N
2026-01-08 08:26:42.168268+00	3472	0	matin	196.00	200.00	3989.50	47	0	0.00	20.9	57.40	\N
2026-01-08 08:27:42.325917+00	3489	1	matin	221.60	221.70	4857.00	53	0	0.00	19.8	60.50	\N
2026-01-08 08:28:12.356405+00	3472	1	soir	222.00	233.30	4250.70	47	0	0.00	22.1	55.60	\N
2026-01-08 08:30:12.563387+00	3489	3	soir	285.30	280.00	5384.30	53	0	0.00	21.8	71.60	\N
2026-01-08 08:30:42.599059+00	3472	4	matin	286.90	286.70	4666.40	45	0	4.26	19.4	60.50	\N
2026-01-08 08:30:42.610702+00	3489	4	matin	286.80	286.70	5485.50	53	0	0.00	22.1	68.80	\N
2026-01-08 08:31:12.653839+00	3472	4	soir	307.10	303.30	4746.60	45	0	4.26	19.2	69.40	\N
2026-01-08 08:31:12.663154+00	3489	4	soir	302.20	303.30	5585.10	53	0	0.00	21.7	62.60	\N
2026-01-08 08:31:42.699515+00	3472	5	matin	317.70	308.30	4823.20	45	0	4.26	22.3	71.80	\N
2026-01-08 08:31:42.715897+00	3489	5	matin	323.40	308.30	5681.90	53	0	0.00	20.6	66.70	\N
2026-01-08 08:26:42.241531+00	3570	0	matin	199.90	200.00	4633.40	45	0	0.00	19.5	74.00	\N
2026-01-08 08:27:12.272701+00	3570	0	soir	207.40	210.00	4746.10	45	0	0.00	22.5	65.00	\N
2026-01-08 08:27:42.321952+00	3570	1	matin	230.70	223.60	4853.90	45	0	0.00	21.8	66.10	\N
2026-01-08 08:28:12.362054+00	3570	1	soir	233.70	235.50	4961.90	45	0	0.00	22.0	59.30	\N
2026-01-08 08:28:42.400588+00	3570	2	matin	256.10	247.30	5068.40	45	0	0.00	19.5	68.00	\N
2026-01-08 08:29:12.446107+00	3570	2	soir	253.50	260.90	5172.50	45	0	0.00	22.3	72.80	\N
2026-01-08 08:29:12.451705+00	3489	2	soir	246.10	256.70	5177.10	53	0	0.00	20.3	61.70	\N
2026-01-08 08:29:42.510438+00	3472	3	matin	256.20	265.00	4502.40	46	0	2.13	22.0	64.10	\N
2026-01-08 08:29:42.518587+00	3489	3	matin	273.10	265.00	5282.40	53	0	0.00	20.3	55.70	\N
2026-01-08 08:30:12.556563+00	3472	3	soir	271.70	280.00	4586.30	45	0	4.26	20.0	60.00	\N
2026-01-08 08:26:42.24452+00	3489	0	matin	191.80	200.00	4632.50	53	0	0.00	21.1	64.40	\N
2026-01-08 08:27:12.266769+00	3472	0	soir	200.10	210.00	4077.40	47	0	0.00	19.9	59.30	\N
2026-01-08 08:27:12.276318+00	3489	0	soir	219.40	210.00	4744.80	53	0	0.00	19.4	63.00	\N
2026-01-08 08:27:42.316883+00	3472	1	matin	211.60	221.70	4164.70	47	0	0.00	19.9	73.90	\N
2026-01-08 08:28:12.367663+00	3489	1	soir	231.70	233.30	4965.20	53	0	0.00	21.1	60.50	\N
2026-01-08 08:28:42.397552+00	3472	2	matin	247.50	243.30	4336.30	46	0	2.13	19.2	64.90	\N
2026-01-08 08:28:42.403807+00	3489	2	matin	243.40	243.30	5071.00	53	0	0.00	21.6	68.50	\N
2026-01-08 08:29:12.437308+00	3472	2	soir	256.80	256.70	4420.20	46	0	2.13	19.0	56.00	\N
2026-01-08 08:29:42.514352+00	3570	3	matin	268.10	270.90	5277.70	45	0	0.00	22.9	55.70	\N
2026-01-08 08:30:12.560513+00	3570	3	soir	295.10	286.40	5380.80	45	0	0.00	21.1	56.20	\N
2026-01-08 08:30:42.603998+00	3570	4	matin	300.10	294.50	5482.60	44	0	2.22	20.1	74.20	\N
2026-01-08 08:31:12.659835+00	3570	4	soir	300.70	311.80	5583.20	44	0	2.22	20.8	71.40	\N
2026-01-08 08:31:42.70997+00	3570	5	matin	330.90	318.20	5679.60	44	0	2.22	20.5	66.10	\N
2026-01-08 08:32:12.761095+00	3472	5	soir	336.00	326.70	4899.90	45	0	4.26	21.2	59.90	\N
2026-01-08 08:32:12.768082+00	3489	5	soir	323.90	326.70	5777.70	53	0	0.00	22.0	71.80	\N
2026-01-08 08:32:42.787626+00	3472	6	matin	327.10	330.00	4975.80	45	0	4.26	22.3	66.80	\N
2026-01-08 08:32:42.794218+00	3570	6	matin	334.00	341.80	5867.40	44	0	2.22	21.2	64.40	\N
2026-01-08 08:32:42.800852+00	3489	6	matin	336.70	330.00	5872.70	53	0	0.00	22.6	57.90	\N
2026-01-08 08:33:12.822624+00	3472	6	soir	342.70	350.00	5050.80	45	0	4.26	19.8	57.90	\N
2026-01-08 08:33:12.826201+00	3570	6	soir	367.90	362.70	5960.20	44	0	2.22	21.1	71.00	\N
2026-01-08 08:33:12.830857+00	3489	6	soir	355.00	350.00	5964.30	53	0	0.00	22.2	68.30	\N
2026-01-08 08:33:42.862384+00	3472	7	matin	338.00	351.70	5122.70	45	0	4.26	19.2	74.00	\N
2026-01-08 08:33:42.870298+00	3570	7	matin	381.20	365.50	6048.50	44	0	2.22	20.0	60.20	\N
2026-01-08 08:33:42.8783+00	3489	7	matin	339.40	351.70	6054.30	53	0	0.00	22.8	61.20	\N
2026-01-08 08:34:12.927937+00	3472	7	soir	365.60	373.30	5191.70	45	0	4.26	21.0	70.20	\N
2026-01-08 08:34:12.934443+00	3570	7	soir	370.80	388.20	6135.90	44	0	2.22	21.5	56.00	\N
2026-01-08 08:34:12.941262+00	3489	7	soir	375.40	373.30	6146.90	53	0	0.00	22.8	60.20	\N
2026-01-08 08:34:42.999289+00	3472	8	matin	364.00	373.30	5262.40	45	0	4.26	20.0	64.40	\N
2026-01-08 08:34:43.003048+00	3570	8	matin	389.70	389.10	6220.10	44	0	2.22	21.9	69.40	\N
2026-01-08 08:34:43.00681+00	3489	8	matin	387.60	373.30	6233.60	53	0	0.00	21.3	55.30	\N
2026-01-08 08:35:13.064006+00	3472	8	soir	379.60	396.70	5332.90	45	0	4.26	19.9	57.20	\N
2026-01-08 08:35:13.074433+00	3570	8	soir	420.30	413.60	6306.90	44	0	2.22	20.5	73.00	\N
2026-01-08 08:35:13.081538+00	3489	8	soir	379.70	396.70	6323.80	53	0	0.00	21.2	70.10	\N
2026-01-08 08:35:43.143339+00	3472	9	matin	379.00	395.00	5399.90	45	0	4.26	19.1	66.50	\N
2026-01-08 08:35:43.148079+00	3570	9	matin	399.70	412.70	6390.70	44	0	2.22	20.2	66.30	\N
2026-01-08 08:35:43.154477+00	3489	9	matin	381.30	395.00	6408.90	53	0	0.00	21.4	58.70	\N
2026-01-08 08:36:13.1948+00	3472	9	soir	421.90	420.00	5467.40	45	0	4.26	19.1	59.20	\N
2026-01-08 08:36:13.199426+00	3570	9	soir	438.60	439.10	6470.40	44	0	2.22	22.4	65.60	\N
2026-01-08 08:36:13.202706+00	3489	9	soir	439.70	420.00	6494.00	53	0	0.00	22.5	55.50	\N
2026-01-08 08:36:43.227409+00	3472	10	matin	424.40	416.70	5533.80	45	0	4.26	19.1	63.10	\N
2026-01-08 08:36:43.233598+00	3570	10	matin	425.80	436.40	6549.70	44	0	2.22	21.6	67.10	\N
2026-01-08 08:36:43.237593+00	3489	10	matin	413.30	416.70	6575.70	53	0	0.00	22.7	73.60	\N
2026-01-08 08:37:13.287505+00	3472	10	soir	439.90	443.30	5597.30	45	0	4.26	19.7	65.80	\N
2026-01-08 08:37:13.292202+00	3570	10	soir	482.90	464.50	6627.30	44	0	2.22	20.0	56.50	\N
2026-01-08 08:37:13.295145+00	3489	10	soir	435.30	443.30	6657.00	53	0	0.00	21.4	64.30	\N
2026-01-08 08:37:43.347465+00	3472	11	matin	433.80	438.30	5660.10	45	0	4.26	21.6	67.00	\N
2026-01-08 08:37:43.351249+00	3570	11	matin	455.70	460.00	6702.00	44	0	2.22	19.6	73.70	\N
2026-01-08 08:38:13.386135+00	3472	11	soir	488.80	466.70	5723.10	45	0	4.26	20.2	63.10	\N
2026-01-08 08:38:13.393013+00	3570	11	soir	483.20	490.00	6777.10	44	0	2.22	21.2	64.50	\N
2026-01-08 08:38:13.398456+00	3489	11	soir	455.40	466.70	6813.80	53	0	0.00	21.2	67.40	\N
2026-01-08 08:38:43.456768+00	3472	12	matin	469.60	460.00	5783.70	45	0	4.26	19.1	73.70	\N
2026-01-08 08:38:43.461589+00	3489	12	matin	455.20	460.00	6891.00	53	0	0.00	19.8	55.10	\N
2026-01-08 08:39:13.494226+00	3472	12	soir	481.80	490.00	5843.60	45	0	4.26	22.8	71.90	\N
2026-01-08 08:39:13.501345+00	3489	12	soir	486.30	490.00	6963.40	53	0	0.00	20.1	63.70	\N
2026-01-08 08:39:49.147476+00	3472	0	matin	197.20	200.00	4616.70	51	0	0.00	22.8	72.80	\N
2026-01-08 08:39:49.220941+00	3488	0	matin	194.50	200.00	3998.50	51	0	0.00	22.3	63.80	\N
2026-01-08 08:39:49.224179+00	3489	0	matin	192.40	200.00	4200.30	45	0	0.00	21.2	67.90	\N
2026-01-08 08:40:19.240532+00	3472	0	soir	205.20	210.00	4726.70	51	0	0.00	21.8	65.80	\N
2026-01-08 08:40:19.244853+00	3488	0	soir	207.30	210.00	4091.00	51	0	0.00	19.1	62.10	\N
2026-01-08 08:40:19.248625+00	3489	0	soir	219.70	210.00	4294.50	44	0	2.22	22.1	69.40	\N
2026-01-08 08:40:49.287907+00	3472	1	matin	222.90	221.70	4833.40	51	0	0.00	22.3	55.10	\N
2026-01-08 08:40:49.292505+00	3488	1	matin	225.30	220.00	4178.20	51	0	0.00	19.4	59.30	\N
2026-01-08 08:40:49.300167+00	3489	1	matin	229.20	218.60	4391.20	44	0	2.22	19.5	71.50	\N
2026-01-08 08:41:19.314956+00	3472	1	soir	243.40	233.30	4942.30	51	0	0.00	21.5	65.60	\N
2026-01-08 08:41:19.320011+00	3488	1	soir	225.10	231.50	4267.80	51	0	0.00	20.7	56.40	\N
2026-01-08 08:41:19.324005+00	3489	1	soir	225.50	230.00	4486.30	44	0	2.22	20.0	57.30	\N
2026-01-08 08:41:49.349099+00	3472	2	matin	240.20	243.30	5050.70	51	0	0.00	19.8	68.50	\N
2026-01-08 08:41:49.355507+00	3488	2	matin	240.80	240.00	4354.60	51	0	0.00	21.8	65.20	\N
2026-01-08 08:41:49.360956+00	3489	2	matin	243.90	237.10	4579.00	44	0	2.22	19.4	61.80	\N
2026-01-08 08:42:19.394608+00	3472	2	soir	259.90	256.70	5153.70	51	0	0.00	20.1	73.30	\N
2026-01-08 08:42:19.39834+00	3488	2	soir	250.30	253.10	4440.60	50	0	1.96	20.6	56.50	\N
2026-01-08 08:42:19.401869+00	3489	2	soir	262.00	250.00	4671.80	44	0	2.22	19.5	55.40	\N
2026-01-08 08:42:49.449134+00	3472	3	matin	276.00	265.00	5259.70	51	0	0.00	22.0	73.60	\N
2026-01-08 08:42:49.452473+00	3488	3	matin	265.10	260.00	4521.40	50	0	1.96	21.7	59.80	\N
2026-01-08 08:42:49.455506+00	3489	3	matin	248.10	255.70	4765.00	44	0	2.22	22.3	71.90	\N
2026-01-08 08:43:19.463354+00	3472	3	soir	269.40	280.00	5362.60	51	0	0.00	21.6	65.50	\N
2026-01-08 08:43:19.469427+00	3488	3	soir	283.50	274.60	4603.40	50	0	1.96	21.2	59.60	\N
2026-01-08 08:43:19.472544+00	3489	3	soir	259.10	270.00	4856.90	44	0	2.22	19.0	66.90	\N
2026-01-08 08:43:49.478395+00	3472	4	matin	291.60	286.70	5463.50	51	0	0.00	22.5	62.40	\N
2026-01-08 08:43:49.48161+00	3488	4	matin	270.10	280.00	4684.20	50	0	1.96	20.2	59.70	\N
2026-01-08 08:43:49.484376+00	3489	4	matin	266.30	274.30	4943.70	44	0	2.22	19.8	62.10	\N
2026-01-08 08:44:19.503924+00	3472	4	soir	301.10	303.30	5561.70	51	0	0.00	19.6	55.50	\N
2026-01-08 08:44:19.510445+00	3488	4	soir	289.10	296.20	4764.90	50	0	1.96	22.4	58.40	\N
2026-01-08 08:44:19.513898+00	3489	4	soir	283.60	290.00	5031.90	44	0	2.22	22.7	72.90	\N
2026-01-08 08:44:49.546279+00	3472	5	matin	297.20	308.30	5659.50	51	0	0.00	20.1	65.00	\N
2026-01-08 08:44:49.549641+00	3488	5	matin	293.90	300.00	4844.10	50	0	1.96	21.4	67.00	\N
2026-01-08 08:44:49.552351+00	3489	5	matin	303.70	292.90	5118.30	44	0	2.22	21.4	66.30	\N
2026-01-08 08:45:19.563685+00	3472	5	soir	333.90	326.70	5754.20	51	0	0.00	22.5	56.60	\N
2026-01-08 08:45:19.568575+00	3488	5	soir	319.80	317.70	4924.00	50	0	1.96	19.9	68.40	\N
2026-01-08 08:45:19.57522+00	3489	5	soir	303.60	310.00	5204.80	44	0	2.22	19.9	69.30	\N
2026-01-08 08:45:49.598657+00	3472	6	matin	324.00	330.00	5845.90	51	0	0.00	21.6	71.00	\N
2026-01-08 08:45:49.602595+00	3488	6	matin	329.20	320.00	5000.20	50	0	1.96	22.7	58.10	\N
2026-01-08 08:45:49.605747+00	3489	6	matin	323.90	311.40	5288.70	44	0	2.22	22.9	58.40	\N
2026-01-08 08:46:19.613464+00	3472	6	soir	366.30	350.00	5943.80	51	0	0.00	20.3	69.50	\N
2026-01-08 08:46:19.61912+00	3488	6	soir	349.60	339.20	5077.00	50	0	1.96	20.2	58.70	\N
2026-01-08 08:46:19.627977+00	3489	6	soir	315.20	330.00	5372.60	44	0	2.22	23.0	67.20	\N
2026-01-08 08:46:49.642711+00	3472	7	matin	356.00	351.70	6038.60	51	0	0.00	21.9	61.90	\N
2026-01-08 08:46:49.646129+00	3488	7	matin	327.30	340.00	5149.80	50	0	1.96	19.2	71.10	\N
2026-01-08 08:46:49.650193+00	3489	7	matin	329.60	330.00	5453.00	44	0	2.22	20.9	63.80	\N
2026-01-08 08:47:19.661072+00	3472	7	soir	391.00	373.30	6128.80	51	0	0.00	22.1	55.40	\N
2026-01-08 08:47:19.670389+00	3489	7	soir	360.30	350.00	5534.90	44	0	2.22	20.7	74.20	\N
2026-01-08 08:47:19.66592+00	3488	7	soir	368.40	360.80	5222.90	50	0	1.96	22.9	69.00	\N
2026-01-08 08:47:49.700426+00	3472	8	matin	386.70	373.30	6219.80	51	0	0.00	21.0	73.50	\N
2026-01-08 08:47:49.71169+00	3488	8	matin	357.30	360.00	5292.00	50	0	1.96	19.9	58.80	\N
2026-01-08 08:47:49.72391+00	3489	8	matin	354.30	348.60	5613.70	44	0	2.22	19.7	62.20	\N
2026-01-08 08:48:19.760469+00	3472	8	soir	394.50	396.70	6308.80	51	0	0.00	22.0	67.70	\N
2026-01-08 08:48:19.765694+00	3488	8	soir	375.10	382.30	5363.20	50	0	1.96	22.7	72.00	\N
2026-01-08 08:48:19.76889+00	3489	8	soir	355.60	370.00	5690.20	44	0	2.22	19.8	57.50	\N
2026-01-08 08:48:49.800049+00	3472	9	matin	412.80	395.00	6391.80	51	0	0.00	20.3	59.90	\N
2026-01-08 08:48:49.80718+00	3488	9	matin	374.70	380.00	5432.10	50	0	1.96	19.0	58.60	\N
2026-01-08 08:48:49.811848+00	3489	9	matin	356.90	367.10	5766.10	44	0	2.22	22.3	67.60	\N
2026-01-08 08:49:19.8316+00	3472	9	soir	424.70	420.00	6477.70	51	0	0.00	20.6	71.60	\N
2026-01-08 08:49:19.834922+00	3488	9	soir	387.00	403.80	5502.10	50	0	1.96	20.6	67.10	\N
2026-01-08 08:49:19.837493+00	3489	9	soir	380.10	390.00	5843.90	44	0	2.22	22.2	72.50	\N
2026-01-08 08:49:49.866119+00	3472	10	matin	424.50	416.70	6559.80	51	0	0.00	20.0	72.00	\N
2026-01-08 08:49:49.870286+00	3488	10	matin	404.80	400.00	5570.00	50	0	1.96	19.4	69.10	\N
2026-01-08 08:49:49.87325+00	3489	10	matin	385.60	385.70	5915.50	44	0	2.22	19.7	67.80	\N
2026-01-08 08:50:19.901705+00	3472	10	soir	427.00	443.30	6639.30	51	0	0.00	21.6	55.40	\N
2026-01-08 08:50:19.910945+00	3489	10	soir	400.40	410.00	5986.80	43	0	4.44	21.7	69.90	\N
2026-01-08 08:50:19.906694+00	3488	10	soir	446.00	425.40	5637.40	50	0	1.96	20.0	56.20	\N
2026-01-08 08:50:49.927625+00	3472	11	matin	425.00	438.30	6717.00	51	0	0.00	21.5	58.60	\N
2026-01-08 08:50:49.936065+00	3488	11	matin	424.50	420.00	5701.00	50	0	1.96	19.9	61.80	\N
2026-01-08 08:50:49.941405+00	3489	11	matin	384.10	404.30	6058.50	43	0	4.44	19.6	57.80	\N
2026-01-08 08:51:19.973622+00	3472	11	soir	466.00	466.70	6795.30	51	0	0.00	21.7	56.50	\N
2026-01-08 08:51:19.98047+00	3488	11	soir	457.30	446.90	5765.80	50	0	1.96	20.1	57.60	\N
2026-01-08 08:51:19.984201+00	3489	11	soir	411.10	430.00	6130.00	43	0	4.44	22.2	71.70	\N
2026-01-08 08:51:50.006144+00	3472	12	matin	439.80	460.00	6867.80	51	0	0.00	21.1	62.00	\N
2026-01-08 08:51:50.016196+00	3489	12	matin	412.30	422.90	6198.10	43	0	4.44	20.0	63.30	\N
2026-01-08 08:51:50.011352+00	3488	12	matin	445.00	440.00	5829.90	50	0	1.96	20.1	61.80	\N
2026-01-08 08:52:20.048848+00	3472	12	soir	513.70	490.00	6943.70	51	0	0.00	19.0	67.40	\N
2026-01-08 08:52:20.054472+00	3488	12	soir	486.60	468.50	5893.00	50	0	1.96	20.5	70.80	\N
2026-01-08 08:52:20.058856+00	3489	12	soir	445.20	450.00	6267.10	43	0	4.44	19.1	62.90	\N
2026-01-08 08:52:50.091027+00	3488	13	matin	440.40	460.00	5953.70	50	0	1.96	19.3	63.50	\N
2026-01-08 08:52:50.096791+00	3489	13	matin	428.40	441.40	6335.80	43	0	4.44	21.6	71.10	\N
2026-01-08 08:53:20.102646+00	3488	13	soir	485.80	490.00	6015.50	50	0	1.96	19.6	64.30	\N
2026-01-08 08:53:20.108896+00	3489	13	soir	474.60	470.00	6402.50	43	0	4.44	21.8	65.60	\N
2026-01-08 08:53:50.139449+00	3489	14	matin	476.50	460.00	6468.10	43	0	4.44	19.5	60.60	\N
2026-01-08 08:54:20.169721+00	3489	14	soir	477.60	490.00	6533.40	43	0	4.44	21.4	60.90	\N
2026-01-08 08:54:56.147501+00	3487	0	matin	192.50	200.00	3993.20	50	0	0.00	20.9	74.60	\N
2026-01-08 08:54:56.221157+00	3474	0	matin	203.60	200.00	4615.20	49	0	0.00	20.8	63.40	\N
2026-01-08 08:54:56.224018+00	4516	0	matin	195.20	200.00	4620.60	54	0	0.00	20.5	62.70	\N
2026-01-08 08:55:26.25452+00	3487	0	soir	207.00	210.00	4084.80	50	0	0.00	19.9	58.90	\N
2026-01-08 08:55:26.26856+00	3474	0	soir	206.00	210.00	4726.60	49	0	0.00	19.7	56.90	\N
2026-01-08 08:55:26.280927+00	4516	0	soir	217.40	210.00	4731.60	54	0	0.00	22.5	69.20	\N
2026-01-08 08:55:56.338978+00	3487	1	matin	222.80	223.60	4173.20	50	0	0.00	22.1	56.40	\N
2026-01-08 08:55:56.342254+00	3474	1	matin	227.80	223.60	4831.60	49	0	0.00	20.8	71.70	\N
2026-01-08 08:55:56.346266+00	4516	1	matin	222.20	221.70	4840.50	54	0	0.00	21.9	66.10	\N
2026-01-08 08:56:26.353929+00	3487	1	soir	242.40	235.50	4261.10	50	0	0.00	19.5	63.30	\N
2026-01-08 08:56:26.361849+00	4516	1	soir	243.90	233.30	4947.80	54	0	0.00	19.0	63.90	\N
2026-01-08 08:56:56.396315+00	3474	2	matin	254.60	247.30	5047.60	49	0	0.00	21.2	68.50	\N
2026-01-08 08:57:26.429445+00	3487	2	soir	264.80	260.90	4430.40	50	0	0.00	22.4	71.80	\N
2026-01-08 08:57:56.488828+00	4516	3	matin	268.80	265.00	5265.90	54	0	0.00	19.8	62.80	\N
2026-01-08 08:58:26.519004+00	3487	3	soir	287.30	286.40	4594.80	50	0	0.00	19.2	58.90	\N
2026-01-08 08:58:56.572183+00	4516	4	matin	282.00	286.70	5467.90	54	0	0.00	21.2	63.90	\N
2026-01-08 08:59:26.603576+00	3474	4	soir	327.30	311.80	5558.80	49	0	0.00	21.3	61.70	\N
2026-01-08 08:59:56.63753+00	3474	5	matin	303.80	318.20	5655.10	49	0	0.00	20.5	70.90	\N
2026-01-08 09:00:26.675182+00	3487	5	soir	333.70	337.30	4905.30	50	0	0.00	19.3	56.00	\N
2026-01-08 09:00:56.708135+00	4516	6	matin	316.60	330.00	5855.20	53	0	1.85	20.6	59.10	\N
2026-01-08 09:01:26.723991+00	3487	6	soir	371.30	362.70	5053.20	50	0	0.00	21.1	56.30	\N
2026-01-08 09:02:26.839455+00	4516	7	soir	385.10	373.30	6126.90	53	0	1.85	20.7	70.00	\N
2026-01-08 09:02:56.847805+00	3487	8	matin	375.80	389.10	5264.10	50	0	0.00	22.5	69.60	\N
2026-01-08 09:03:26.877858+00	4516	8	soir	402.50	396.70	6299.10	53	0	1.85	22.4	58.30	\N
2026-01-08 09:03:56.89027+00	3474	9	matin	400.40	412.70	6363.70	49	0	0.00	21.6	64.50	\N
2026-01-08 09:04:26.936216+00	3474	9	soir	455.40	439.10	6442.50	49	0	0.00	20.6	62.10	\N
2026-01-08 09:04:56.981777+00	3474	10	matin	433.40	436.40	6523.30	48	0	2.04	22.6	67.20	\N
2026-01-08 09:05:27.019693+00	3487	10	soir	462.70	464.50	5590.40	50	0	0.00	21.9	73.70	\N
2026-01-08 09:08:02.986575+00	3489	0	matin	202.30	200.00	4605.80	47	0	0.00	19.3	55.90	\N
2026-01-08 09:08:33.004213+00	3488	0	soir	212.30	210.00	4733.10	55	0	0.00	21.2	69.40	\N
2026-01-08 08:56:56.402597+00	4516	2	matin	231.30	243.30	5055.10	54	0	0.00	20.4	70.90	\N
2026-01-08 08:57:26.434703+00	3474	2	soir	258.80	260.90	5154.70	49	0	0.00	21.0	57.30	\N
2026-01-08 08:57:56.480528+00	3474	3	matin	265.30	270.90	5258.10	49	0	0.00	21.7	73.70	\N
2026-01-08 08:58:26.524227+00	3474	3	soir	284.90	286.40	5358.70	49	0	0.00	20.6	72.30	\N
2026-01-08 08:58:56.567106+00	3474	4	matin	283.00	294.50	5459.20	49	0	0.00	20.8	56.40	\N
2026-01-08 08:59:26.598469+00	3487	4	soir	325.50	311.80	4752.30	50	0	0.00	21.7	68.40	\N
2026-01-08 08:59:56.643776+00	4516	5	matin	317.20	308.30	5662.90	54	0	0.00	20.3	74.90	\N
2026-01-08 09:00:26.679929+00	3474	5	soir	346.40	337.30	5750.70	49	0	0.00	22.3	56.20	\N
2026-01-08 09:00:56.700578+00	3474	6	matin	325.60	341.80	5846.10	49	0	0.00	19.9	59.50	\N
2026-01-08 09:01:26.73076+00	3474	6	soir	353.40	362.70	5936.60	49	0	0.00	22.3	65.20	\N
2026-01-08 09:01:56.77177+00	3474	7	matin	353.30	365.50	6021.20	49	0	0.00	19.9	72.30	\N
2026-01-08 09:02:26.833309+00	3474	7	soir	402.50	388.20	6110.30	49	0	0.00	20.7	60.90	\N
2026-01-08 09:02:56.854257+00	3474	8	matin	373.50	389.10	6195.10	49	0	0.00	21.1	64.70	\N
2026-01-08 09:03:26.872476+00	3474	8	soir	403.30	413.60	6280.60	49	0	0.00	22.8	64.20	\N
2026-01-08 09:03:56.884995+00	3487	9	matin	429.40	412.70	5398.10	50	0	0.00	20.2	69.60	\N
2026-01-08 09:04:26.945012+00	4516	9	soir	408.60	420.00	6469.50	53	0	1.85	21.1	62.20	\N
2026-01-08 09:04:56.976927+00	3487	10	matin	451.70	436.40	5527.60	50	0	0.00	19.8	56.20	\N
2026-01-08 09:05:27.041032+00	4516	10	soir	436.80	443.30	6632.50	53	0	1.85	22.4	68.90	\N
2026-01-08 09:05:57.078669+00	3487	11	matin	478.10	460.00	5649.70	50	0	0.00	21.8	71.50	\N
2026-01-08 09:05:57.099447+00	4516	11	matin	450.80	438.30	6710.70	53	0	1.85	20.4	70.70	\N
2026-01-08 09:06:27.108775+00	3487	11	soir	486.70	490.00	5708.00	50	0	0.00	23.0	64.20	\N
2026-01-08 09:06:27.128259+00	4516	11	soir	467.80	466.70	6788.20	53	0	1.85	22.1	61.60	\N
2026-01-08 09:06:57.14443+00	4516	12	matin	464.00	460.00	6863.60	53	0	1.85	21.6	56.60	\N
2026-01-08 09:07:27.154669+00	4516	12	soir	496.10	490.00	6937.10	53	0	1.85	21.2	55.60	\N
2026-01-08 09:08:02.924738+00	3472	0	matin	208.30	200.00	3983.80	51	0	0.00	22.7	56.60	\N
2026-01-08 09:08:33.012937+00	3489	0	soir	209.80	210.00	4718.10	47	0	0.00	20.0	69.00	\N
2026-01-08 09:09:03.051459+00	3472	1	matin	220.50	218.60	4162.10	51	0	0.00	22.9	71.30	\N
2026-01-08 09:09:33.088895+00	3489	1	soir	225.00	231.50	4939.10	47	0	0.00	19.4	61.80	\N
2026-01-08 09:10:03.097919+00	3472	2	matin	241.50	237.10	4335.10	51	0	0.00	22.2	73.30	\N
2026-01-08 09:10:33.147807+00	3489	2	soir	240.80	253.10	5155.60	47	0	0.00	22.2	66.90	\N
2026-01-08 09:11:03.162419+00	3472	3	matin	267.00	255.70	4502.80	51	0	0.00	21.7	57.90	\N
2026-01-08 09:11:33.201414+00	3489	3	soir	262.80	274.60	5363.60	47	0	0.00	22.8	56.60	\N
2026-01-08 09:12:03.225798+00	3472	4	matin	263.00	274.30	4669.90	50	0	1.96	20.5	64.50	\N
2026-01-08 09:12:33.27878+00	3489	4	soir	286.70	296.20	5567.70	47	0	0.00	22.0	61.60	\N
2026-01-08 09:13:03.306211+00	3472	5	matin	282.50	292.90	4832.20	50	0	1.96	21.8	58.40	\N
2026-01-08 09:13:33.355218+00	3489	5	soir	313.90	317.70	5763.80	46	0	2.13	22.9	59.30	\N
2026-01-08 09:14:03.359491+00	3472	6	matin	313.00	311.40	4990.00	50	0	1.96	22.9	62.40	\N
2026-01-08 09:14:33.385381+00	3489	6	soir	340.70	339.20	5956.00	46	0	2.13	22.9	59.40	\N
2026-01-08 09:15:03.391217+00	3472	7	matin	340.40	330.00	5142.40	50	0	1.96	22.6	65.60	\N
2026-01-08 09:16:33.56665+00	3489	8	soir	363.90	382.30	6321.50	46	0	2.13	19.9	58.50	\N
2026-01-08 09:17:03.579732+00	3472	9	matin	362.40	367.10	5434.20	50	0	1.96	22.8	61.80	\N
2026-01-08 09:17:03.59856+00	3489	9	matin	385.40	380.00	6409.10	46	0	2.13	19.9	64.40	\N
2026-01-08 09:17:33.650798+00	3472	9	soir	384.00	390.00	5504.90	50	0	1.96	21.3	61.80	\N
2026-01-08 09:18:03.680147+00	3489	10	matin	386.60	400.00	6581.30	45	0	4.26	19.5	55.00	\N
2026-01-08 09:18:33.695936+00	3472	10	soir	391.10	410.00	5643.40	49	0	3.92	19.6	55.60	\N
2026-01-08 09:19:03.755637+00	3489	11	matin	415.30	420.00	6746.10	43	0	8.51	21.1	56.10	\N
2026-01-08 09:19:33.788943+00	3472	11	soir	430.30	430.00	5776.80	49	0	3.92	19.6	67.20	\N
2026-01-08 09:23:09.836131+00	4516	0	matin	206.70	200.00	3981.80	49	0	0.00	19.5	67.80	\N
2026-01-08 09:23:39.855864+00	3487	0	soir	215.80	210.00	4304.50	52	0	0.00	19.9	72.00	\N
2026-01-08 09:09:03.056001+00	3488	1	matin	222.60	223.60	4841.20	55	0	0.00	20.7	72.80	\N
2026-01-08 09:09:33.07786+00	3488	1	soir	230.40	235.50	4949.60	55	0	0.00	22.7	56.70	\N
2026-01-08 09:10:03.101009+00	3488	2	matin	236.40	247.30	5057.60	55	0	0.00	22.1	70.10	\N
2026-01-08 09:10:33.135704+00	3472	2	soir	257.10	250.00	4419.10	51	0	0.00	22.0	63.40	\N
2026-01-08 09:11:03.172684+00	3489	3	matin	249.30	260.00	5259.40	47	0	0.00	22.1	70.10	\N
2026-01-08 09:11:33.188851+00	3472	3	soir	278.90	270.00	4588.30	51	0	0.00	20.9	59.00	\N
2026-01-08 09:12:03.240138+00	3489	4	matin	273.50	280.00	5463.30	47	0	0.00	19.3	55.40	\N
2026-01-08 09:12:33.271576+00	3472	4	soir	276.70	290.00	4752.00	50	0	1.96	19.1	55.40	\N
2026-01-08 09:13:03.315151+00	3489	5	matin	307.20	300.00	5665.70	47	0	0.00	20.7	67.30	\N
2026-01-08 09:13:33.348006+00	3472	5	soir	307.20	310.00	4911.60	50	0	1.96	19.8	70.10	\N
2026-01-08 09:14:03.368578+00	3489	6	matin	315.80	320.00	5858.90	46	0	2.13	20.8	68.20	\N
2026-01-08 09:14:33.377982+00	3472	6	soir	341.10	330.00	5067.00	50	0	1.96	21.6	67.10	\N
2026-01-08 09:15:03.400912+00	3489	7	matin	326.00	340.00	6051.70	46	0	2.13	21.1	69.10	\N
2026-01-08 09:15:33.432539+00	3472	7	soir	351.60	350.00	5219.40	50	0	1.96	21.7	71.50	\N
2026-01-08 09:15:33.443012+00	3489	7	soir	371.60	360.80	6144.20	46	0	2.13	22.7	71.00	\N
2026-01-08 09:16:03.489237+00	3472	8	matin	333.70	348.60	5292.60	50	0	1.96	19.0	73.50	\N
2026-01-08 09:16:03.505272+00	3489	8	matin	367.00	360.00	6232.40	46	0	2.13	22.9	64.90	\N
2026-01-08 09:16:33.555399+00	3472	8	soir	371.70	370.00	5364.50	50	0	1.96	21.7	74.10	\N
2026-01-08 09:17:33.661441+00	3489	9	soir	406.80	403.80	6493.30	46	0	2.13	19.5	62.80	\N
2026-01-08 09:18:03.672526+00	3472	10	matin	380.30	385.70	5572.20	50	0	1.96	22.7	64.40	\N
2026-01-08 09:18:33.710747+00	3489	10	soir	443.20	425.40	6667.30	45	0	4.26	20.9	72.40	\N
2026-01-08 09:19:03.750181+00	3488	11	matin	465.80	460.00	6685.10	52	0	5.45	22.8	57.60	\N
2026-01-08 09:19:33.793215+00	3488	11	soir	496.90	490.00	6759.40	52	0	5.45	22.0	62.70	\N
2026-01-08 09:20:03.831533+00	3489	12	matin	432.80	440.00	6902.80	43	0	8.51	21.0	67.20	\N
2026-01-08 09:20:33.84329+00	3472	12	soir	461.30	450.00	5906.00	49	0	3.92	20.3	67.00	\N
2026-01-08 09:21:03.863963+00	3489	13	matin	449.80	460.00	7057.20	43	0	8.51	20.0	55.20	\N
2026-01-08 09:21:33.883736+00	3472	13	soir	470.50	470.00	6029.10	49	0	3.92	21.3	58.00	\N
2026-01-08 09:23:09.832566+00	3488	0	matin	193.50	200.00	4614.30	45	0	0.00	20.5	66.50	\N
2026-01-08 09:23:39.860688+00	3488	0	soir	200.70	210.00	4726.80	45	0	0.00	22.4	69.90	\N
2026-01-08 09:09:03.059084+00	3489	1	matin	220.60	220.00	4829.80	47	0	0.00	19.8	60.20	\N
2026-01-08 09:09:33.067342+00	3472	1	soir	226.70	230.00	4251.50	51	0	0.00	21.0	69.20	\N
2026-01-08 09:10:03.103909+00	3489	2	matin	231.20	240.00	5046.90	47	0	0.00	21.9	64.10	\N
2026-01-08 09:10:33.142939+00	3488	2	soir	257.80	260.90	5165.00	54	0	1.82	19.6	59.70	\N
2026-01-08 09:11:03.168078+00	3488	3	matin	268.10	270.90	5264.90	54	0	1.82	23.0	64.20	\N
2026-01-08 09:11:33.19561+00	3488	3	soir	275.70	286.40	5367.20	54	0	1.82	22.6	71.20	\N
2026-01-08 09:12:03.233486+00	3488	4	matin	299.70	294.50	5464.00	54	0	1.82	21.9	60.40	\N
2026-01-08 09:12:33.275205+00	3488	4	soir	319.10	311.80	5563.60	54	0	1.82	22.2	71.90	\N
2026-01-08 09:13:03.311833+00	3488	5	matin	332.60	318.20	5656.00	54	0	1.82	22.8	65.20	\N
2026-01-08 09:13:33.351547+00	3488	5	soir	340.10	337.30	5750.70	54	0	1.82	19.3	71.40	\N
2026-01-08 09:14:03.365101+00	3488	6	matin	344.30	341.80	5843.60	54	0	1.82	21.9	74.90	\N
2026-01-08 09:14:33.382323+00	3488	6	soir	375.40	362.70	5934.20	53	0	3.64	19.5	70.40	\N
2026-01-08 09:15:03.39615+00	3488	7	matin	361.10	365.50	6025.10	52	0	5.45	20.0	60.00	\N
2026-01-08 09:15:33.437305+00	3488	7	soir	397.20	388.20	6113.10	52	0	5.45	21.0	60.40	\N
2026-01-08 09:16:03.49693+00	3488	8	matin	398.60	389.10	6198.30	52	0	5.45	21.1	56.30	\N
2026-01-08 09:16:33.561505+00	3488	8	soir	410.10	413.60	6286.10	52	0	5.45	21.6	73.30	\N
2026-01-08 09:17:03.589029+00	3488	9	matin	415.40	412.70	6366.60	52	0	5.45	22.0	55.70	\N
2026-01-08 09:17:33.655206+00	3488	9	soir	419.20	439.10	6450.40	52	0	5.45	19.1	59.60	\N
2026-01-08 09:18:03.675947+00	3488	10	matin	439.90	436.40	6528.50	52	0	5.45	20.8	71.20	\N
2026-01-08 09:18:33.702399+00	3488	10	soir	453.40	464.50	6606.90	52	0	5.45	22.9	68.00	\N
2026-01-08 09:19:03.743472+00	3472	11	matin	397.20	404.30	5711.20	49	0	3.92	21.7	73.00	\N
2026-01-08 09:19:33.795929+00	3489	11	soir	444.70	446.90	6827.40	43	0	8.51	19.7	61.10	\N
2026-01-08 09:20:03.82706+00	3472	12	matin	413.10	422.90	5841.60	49	0	3.92	22.5	69.90	\N
2026-01-08 09:20:33.849852+00	3489	12	soir	445.50	468.50	6983.20	43	0	8.51	20.2	71.20	\N
2026-01-08 09:21:03.85866+00	3472	13	matin	462.70	441.40	5967.00	49	0	3.92	21.2	55.90	\N
2026-01-08 09:21:33.88964+00	3489	13	soir	482.60	490.00	7131.70	43	0	8.51	20.6	63.90	\N
2026-01-08 09:22:03.931677+00	3472	14	matin	450.20	460.00	6089.20	49	0	3.92	20.6	63.40	\N
2026-01-08 09:22:33.965617+00	3472	14	soir	507.40	490.00	6149.00	49	0	3.92	22.1	57.00	\N
2026-01-08 09:23:09.768219+00	3487	0	matin	194.60	200.00	4207.30	52	0	0.00	22.8	67.10	\N
2026-01-08 09:23:39.865986+00	4516	0	soir	205.20	210.00	4071.30	49	0	0.00	22.9	74.80	\N
2026-01-08 09:24:09.898646+00	3487	1	matin	227.70	218.60	4398.30	52	0	0.00	22.7	75.00	\N
2026-01-08 09:24:39.946855+00	4516	1	soir	224.90	233.30	4243.20	49	0	0.00	20.1	61.30	\N
2026-01-08 09:25:09.976548+00	3487	2	matin	242.70	237.10	4588.60	52	0	0.00	22.7	67.80	\N
2026-01-08 09:25:40.020673+00	4516	2	soir	265.50	256.70	4412.40	49	0	0.00	20.3	64.80	\N
2026-01-08 09:26:10.052262+00	3487	3	matin	259.30	255.70	4771.30	51	0	1.92	19.5	72.50	\N
2026-01-08 09:26:40.084864+00	4516	3	soir	274.80	280.00	4574.70	49	0	0.00	21.4	67.00	\N
2026-01-08 09:27:10.101648+00	3488	4	matin	275.30	274.30	5474.10	44	0	2.22	22.1	71.20	\N
2026-01-08 09:27:40.142728+00	3488	4	soir	278.50	290.00	5578.80	44	0	2.22	22.3	73.90	\N
2026-01-08 09:28:10.183406+00	3488	5	matin	305.20	292.90	5682.80	44	0	2.22	21.7	74.80	\N
2026-01-08 09:28:40.200991+00	3488	5	soir	312.20	310.00	5779.50	44	0	2.22	19.5	70.00	\N
2026-01-08 09:29:10.234484+00	3488	6	matin	297.80	311.40	5878.00	44	0	2.22	22.6	74.10	\N
2026-01-08 09:29:40.273894+00	3488	6	soir	339.60	330.00	5973.80	44	0	2.22	20.9	70.00	\N
2026-01-08 09:30:10.320792+00	3488	7	matin	323.10	330.00	6068.10	44	0	2.22	22.1	58.90	\N
2026-01-08 09:30:40.366033+00	3488	7	soir	337.10	350.00	6163.40	44	0	2.22	19.1	69.90	\N
2026-01-08 09:31:10.385171+00	3488	8	matin	344.50	348.60	6253.30	44	0	2.22	19.5	61.60	\N
2026-01-08 09:31:40.432983+00	3488	8	soir	374.10	370.00	6344.60	44	0	2.22	19.5	63.80	\N
2026-01-08 09:32:10.455312+00	3488	9	matin	385.10	367.10	6431.00	44	0	2.22	19.5	63.20	\N
2026-01-08 09:32:40.472945+00	3488	9	soir	403.50	390.00	6518.00	44	0	2.22	21.1	62.00	\N
2026-01-08 09:33:10.523058+00	3488	10	matin	388.00	385.70	6603.90	44	0	2.22	19.3	64.60	\N
2026-01-08 09:33:40.56627+00	3488	10	soir	413.70	410.00	6692.00	44	0	2.22	20.4	73.50	\N
2026-01-08 09:34:10.605281+00	3488	11	matin	422.90	404.30	6775.30	44	0	2.22	21.3	73.60	\N
2026-01-08 09:34:40.64004+00	3488	11	soir	449.70	430.00	6860.00	44	0	2.22	19.4	72.60	\N
2026-01-08 09:35:10.68364+00	3488	12	matin	441.50	422.90	6938.30	44	0	2.22	22.9	69.60	\N
2026-01-08 09:35:40.722158+00	3488	12	soir	453.30	450.00	7019.50	44	0	2.22	21.7	62.30	\N
2026-01-08 09:36:10.759957+00	3488	13	matin	421.90	441.40	7096.30	44	0	2.22	21.1	72.40	\N
2026-01-08 09:36:40.792446+00	3487	13	soir	473.60	470.00	6411.20	51	0	1.92	23.0	67.00	\N
2026-01-08 09:37:10.80154+00	3488	14	matin	471.90	460.00	7246.90	44	0	2.22	21.5	70.60	\N
2026-01-08 09:37:40.836741+00	3487	14	soir	484.60	490.00	6542.00	51	0	1.92	20.9	62.50	\N
2026-01-08 09:38:16.656165+00	3474	0	matin	192.50	200.00	4612.80	46	0	2.13	20.8	66.40	\N
2026-01-08 09:38:46.710383+00	3474	0	soir	207.40	210.00	4725.70	46	0	2.13	22.5	59.90	\N
2026-01-08 09:39:16.756154+00	3474	1	matin	226.10	221.70	4836.30	46	0	2.13	19.5	66.30	\N
2026-01-08 09:39:46.781904+00	3474	1	soir	241.60	233.30	4944.00	46	0	2.13	22.4	72.40	\N
2026-01-08 09:24:09.903058+00	3488	1	matin	221.10	218.60	4838.80	45	0	0.00	19.4	63.10	\N
2026-01-08 09:24:39.942669+00	3488	1	soir	222.60	230.00	4948.20	45	0	0.00	19.6	61.80	\N
2026-01-08 09:25:09.982251+00	3488	2	matin	243.40	237.10	5055.50	45	0	0.00	21.9	63.20	\N
2026-01-08 09:25:40.014202+00	3487	2	soir	245.90	250.00	4683.20	52	0	0.00	22.6	60.10	\N
2026-01-08 09:26:10.06045+00	4516	3	matin	259.40	265.00	4492.40	49	0	0.00	20.9	72.70	\N
2026-01-08 09:26:40.070966+00	3487	3	soir	269.90	270.00	4860.80	51	0	1.92	20.1	56.00	\N
2026-01-08 09:27:10.107053+00	4516	4	matin	289.20	286.70	4656.10	49	0	0.00	22.0	60.50	\N
2026-01-08 09:27:40.139298+00	3487	4	soir	289.90	290.00	5037.40	51	0	1.92	19.9	62.50	\N
2026-01-08 09:28:10.188463+00	4516	5	matin	321.10	308.30	4812.10	49	0	0.00	22.6	66.80	\N
2026-01-08 09:28:40.194952+00	3487	5	soir	319.10	310.00	5208.10	51	0	1.92	20.0	66.70	\N
2026-01-08 09:29:10.237458+00	4516	6	matin	320.70	330.00	4966.90	49	0	0.00	22.6	61.40	\N
2026-01-08 09:29:40.268623+00	3487	6	soir	333.90	330.00	5372.90	51	0	1.92	22.7	74.50	\N
2026-01-08 09:30:10.326806+00	4516	7	matin	343.20	351.70	5116.10	49	0	0.00	19.2	62.50	\N
2026-01-08 09:30:40.360055+00	3487	7	soir	358.30	350.00	5535.20	51	0	1.92	22.3	63.90	\N
2026-01-08 09:31:10.389643+00	4516	8	matin	357.90	373.30	5260.50	49	0	0.00	21.6	70.30	\N
2026-01-08 09:31:40.426248+00	3487	8	soir	368.10	370.00	5692.40	51	0	1.92	21.8	62.80	\N
2026-01-08 09:32:10.460964+00	4516	9	matin	409.00	395.00	5397.20	49	0	0.00	20.7	74.30	\N
2026-01-08 09:32:40.464846+00	3487	9	soir	373.00	390.00	5848.90	51	0	1.92	22.2	66.30	\N
2026-01-08 09:33:10.530563+00	4516	10	matin	415.90	416.70	5529.40	49	0	0.00	19.8	65.70	\N
2026-01-08 09:33:40.562716+00	3487	10	soir	412.80	410.00	5997.40	51	0	1.92	20.7	58.10	\N
2026-01-08 09:34:10.610941+00	4516	11	matin	436.90	438.30	5658.00	49	0	0.00	21.1	62.30	\N
2026-01-08 09:34:40.633981+00	3487	11	soir	443.80	430.00	6139.40	51	0	1.92	21.8	64.10	\N
2026-01-08 09:35:10.68682+00	4516	12	matin	466.30	460.00	5780.50	49	0	0.00	20.2	60.70	\N
2026-01-08 09:35:40.717696+00	3487	12	soir	465.80	450.00	6277.10	51	0	1.92	21.4	58.40	\N
2026-01-08 09:38:46.716489+00	4516	0	soir	213.80	210.00	4075.40	49	0	0.00	19.9	70.70	\N
2026-01-08 09:39:16.751526+00	3472	1	matin	223.60	221.70	4835.60	45	0	0.00	21.3	63.40	\N
2026-01-08 09:39:46.785466+00	4516	1	soir	241.00	235.50	4248.60	49	0	0.00	19.5	59.20	\N
2026-01-08 09:24:09.907813+00	4516	1	matin	226.10	221.70	4157.90	49	0	0.00	19.6	64.50	\N
2026-01-08 09:24:39.938392+00	3487	1	soir	227.40	230.00	4494.70	52	0	0.00	21.6	70.00	\N
2026-01-08 09:25:09.987401+00	4516	2	matin	239.50	243.30	4326.70	49	0	0.00	21.0	56.20	\N
2026-01-08 09:25:40.017503+00	3488	2	soir	239.00	250.00	5161.90	44	0	2.22	19.0	57.10	\N
2026-01-08 09:26:10.057459+00	3488	3	matin	260.00	255.70	5269.10	44	0	2.22	21.7	73.40	\N
2026-01-08 09:26:40.079027+00	3488	3	soir	263.40	270.00	5372.60	44	0	2.22	22.1	73.50	\N
2026-01-08 09:27:10.092881+00	3487	4	matin	270.60	274.30	4949.10	51	0	1.92	22.2	66.80	\N
2026-01-08 09:27:40.146405+00	4516	4	soir	291.60	303.30	4736.60	49	0	0.00	19.9	70.00	\N
2026-01-08 09:28:10.177713+00	3487	5	matin	278.70	292.90	5123.50	51	0	1.92	19.9	62.50	\N
2026-01-08 09:28:40.204678+00	4516	5	soir	331.40	326.70	4890.20	49	0	0.00	22.3	69.70	\N
2026-01-08 09:29:10.230616+00	3487	6	matin	321.50	311.40	5290.10	51	0	1.92	19.4	64.50	\N
2026-01-08 09:29:40.280603+00	4516	6	soir	333.20	350.00	5044.10	49	0	0.00	19.1	56.00	\N
2026-01-08 09:30:10.313106+00	3487	7	matin	322.10	330.00	5453.70	51	0	1.92	21.7	62.50	\N
2026-01-08 09:30:40.369065+00	4516	7	soir	368.50	373.30	5188.60	49	0	0.00	19.3	71.60	\N
2026-01-08 09:31:10.380235+00	3487	8	matin	353.50	348.60	5614.70	51	0	1.92	19.4	55.90	\N
2026-01-08 09:31:40.439327+00	4516	8	soir	415.80	396.70	5329.80	49	0	0.00	22.3	68.50	\N
2026-01-08 09:32:10.451254+00	3487	9	matin	358.10	367.10	5770.70	51	0	1.92	20.3	65.70	\N
2026-01-08 09:32:40.479847+00	4516	9	soir	422.50	420.00	5463.90	49	0	0.00	22.5	65.80	\N
2026-01-08 09:33:10.514343+00	3487	10	matin	400.40	385.70	5922.80	51	0	1.92	21.6	57.40	\N
2026-01-08 09:33:40.56898+00	4516	10	soir	436.90	443.30	5594.90	49	0	0.00	22.6	71.60	\N
2026-01-08 09:34:10.600333+00	3487	11	matin	395.10	404.30	6068.20	51	0	1.92	21.2	70.70	\N
2026-01-08 09:34:40.647045+00	4516	11	soir	465.30	466.70	5720.50	49	0	0.00	22.9	56.80	\N
2026-01-08 09:35:10.680386+00	3487	12	matin	405.80	422.90	6208.70	51	0	1.92	21.5	63.10	\N
2026-01-08 09:35:40.725156+00	4516	12	soir	476.70	490.00	5841.70	49	0	0.00	19.7	64.90	\N
2026-01-08 09:36:10.756888+00	3487	13	matin	443.90	441.40	6344.80	51	0	1.92	19.2	62.60	\N
2026-01-08 09:36:40.795837+00	3488	13	soir	455.20	470.00	7171.40	44	0	2.22	21.4	64.20	\N
2026-01-08 09:37:10.79696+00	3487	14	matin	464.50	460.00	6476.10	51	0	1.92	21.2	60.20	\N
2026-01-08 09:37:40.842862+00	3488	14	soir	494.50	490.00	7322.40	43	0	4.44	20.1	57.20	\N
2026-01-08 09:38:16.585729+00	3472	0	matin	197.40	200.00	4614.90	45	0	0.00	19.3	55.70	\N
2026-01-08 09:38:16.660513+00	4516	0	matin	201.20	200.00	3985.00	49	0	0.00	19.6	55.50	\N
2026-01-08 09:38:46.703905+00	3472	0	soir	203.20	210.00	4723.00	45	0	0.00	21.4	55.40	\N
2026-01-08 09:39:16.759295+00	4516	1	matin	232.00	223.60	4160.70	49	0	0.00	21.3	55.60	\N
2026-01-08 09:39:46.76981+00	3472	1	soir	240.50	233.30	4944.20	45	0	0.00	21.6	67.80	\N
2026-01-08 09:40:16.793942+00	3472	2	matin	238.40	243.30	5049.70	45	0	0.00	20.4	61.90	\N
2026-01-08 09:40:46.850613+00	4516	2	soir	259.70	260.90	4418.20	48	0	2.04	20.0	67.00	\N
2026-01-08 09:41:16.883226+00	3472	3	matin	268.70	265.00	5257.60	44	0	2.22	19.0	65.30	\N
2026-01-08 09:41:46.916423+00	4516	3	soir	275.50	286.40	4581.30	48	0	2.04	22.7	73.40	\N
2026-01-08 09:42:16.930162+00	3472	4	matin	276.90	286.70	5459.80	44	0	2.22	21.5	72.90	\N
2026-01-08 09:42:46.954972+00	4516	4	soir	306.20	311.80	4736.30	48	0	2.04	22.3	72.00	\N
2026-01-08 09:43:16.983941+00	3472	5	matin	319.30	308.30	5654.20	44	0	2.22	20.8	64.60	\N
2026-01-08 09:43:47.033961+00	4516	5	soir	334.90	337.30	4886.30	48	0	2.04	20.7	74.40	\N
2026-01-08 09:44:17.049954+00	3474	6	matin	320.70	330.00	5848.90	45	0	4.26	20.2	70.60	\N
2026-01-08 09:44:47.10452+00	3474	6	soir	354.60	350.00	5941.50	45	0	4.26	19.3	69.20	\N
2026-01-08 09:45:17.123213+00	3474	7	matin	359.30	351.70	6029.40	45	0	4.26	19.4	62.30	\N
2026-01-08 09:45:47.158465+00	3472	7	soir	376.90	373.30	6121.10	44	0	2.22	21.3	63.30	\N
2026-01-08 09:46:17.20277+00	4516	8	matin	376.10	389.10	5239.90	47	0	4.08	20.9	70.40	\N
2026-01-08 09:46:47.236998+00	3472	8	soir	408.90	396.70	6295.10	44	0	2.22	21.9	67.00	\N
2026-01-08 09:47:17.29481+00	4516	9	matin	410.80	412.70	5371.90	46	0	6.12	20.9	62.20	\N
2026-01-08 09:47:47.323115+00	3472	9	soir	423.70	420.00	6463.70	44	0	2.22	20.5	61.20	\N
2026-01-08 09:48:17.371269+00	4516	10	matin	427.70	436.40	5499.70	46	0	6.12	19.9	60.00	\N
2026-01-08 09:48:47.378778+00	3472	10	soir	431.60	443.30	6625.40	42	0	6.67	22.9	59.30	\N
2026-01-08 09:49:17.43069+00	4516	11	matin	454.30	460.00	5620.80	46	0	6.12	20.5	67.30	\N
2026-01-08 09:49:47.465878+00	3472	11	soir	465.20	466.70	6781.40	42	0	6.67	21.2	71.00	\N
2026-01-08 09:51:23.338667+00	3473	0	matin	192.40	200.00	4608.00	55	0	0.00	22.1	71.50	\N
2026-01-08 09:51:53.349466+00	3487	0	soir	214.70	210.00	4723.30	48	0	2.04	19.6	59.10	\N
2026-01-08 09:52:23.389264+00	3473	1	matin	221.20	220.00	4829.50	55	0	0.00	20.7	65.10	\N
2026-01-08 09:52:53.417811+00	3474	1	soir	226.90	235.50	4932.10	46	0	0.00	21.1	55.50	\N
2026-01-08 09:53:23.456121+00	3487	2	matin	243.80	243.30	5047.70	48	0	2.04	19.0	73.00	\N
2026-01-08 09:53:53.508201+00	3473	2	soir	261.20	253.10	5150.40	54	0	1.82	22.8	56.90	\N
2026-01-08 09:54:23.546189+00	3474	3	matin	273.70	270.90	5244.20	46	0	0.00	19.2	68.90	\N
2026-01-08 09:54:53.593042+00	3474	3	soir	294.90	286.40	5344.60	46	0	0.00	19.0	58.00	\N
2026-01-08 09:55:23.620514+00	3474	4	matin	305.50	294.50	5443.50	46	0	0.00	21.6	62.50	\N
2026-01-08 09:55:53.646555+00	3474	4	soir	305.00	311.80	5543.40	46	0	0.00	22.7	62.00	\N
2026-01-08 09:56:23.688557+00	3474	5	matin	316.20	318.20	5639.40	46	0	0.00	19.3	73.70	\N
2026-01-08 09:56:53.72209+00	3487	5	soir	326.10	326.70	5751.60	45	0	8.16	22.2	60.90	\N
2026-01-08 09:40:16.799944+00	3474	2	matin	244.30	243.30	5052.40	46	0	2.13	19.6	57.70	\N
2026-01-08 09:40:46.845917+00	3474	2	soir	254.80	256.70	5156.40	46	0	2.13	21.3	58.60	\N
2026-01-08 09:41:16.888646+00	3474	3	matin	275.00	265.00	5257.50	46	0	2.13	20.2	71.80	\N
2026-01-08 09:41:46.908069+00	3474	3	soir	272.60	280.00	5360.00	46	0	2.13	19.8	57.50	\N
2026-01-08 09:42:16.933969+00	3474	4	matin	284.80	286.70	5459.40	46	0	2.13	19.0	55.20	\N
2026-01-08 09:42:46.950983+00	3474	4	soir	289.80	303.30	5563.10	46	0	2.13	19.2	67.20	\N
2026-01-08 09:43:16.987113+00	3474	5	matin	323.00	308.30	5659.10	46	0	2.13	22.7	72.50	\N
2026-01-08 09:43:47.026342+00	3474	5	soir	339.30	326.70	5755.10	46	0	2.13	19.8	60.60	\N
2026-01-08 09:44:17.042304+00	3472	6	matin	333.70	330.00	5849.20	44	0	2.22	20.5	60.60	\N
2026-01-08 09:44:47.108508+00	4516	6	soir	359.80	362.70	5032.50	47	0	4.08	19.6	62.40	\N
2026-01-08 09:45:17.11719+00	3472	7	matin	368.80	351.70	6031.40	44	0	2.22	22.9	70.10	\N
2026-01-08 09:45:47.165941+00	4516	7	soir	375.80	388.20	5173.10	47	0	4.08	22.5	59.90	\N
2026-01-08 09:46:17.186044+00	3472	8	matin	357.60	373.30	6207.70	44	0	2.22	19.1	58.60	\N
2026-01-08 09:46:47.253894+00	4516	8	soir	420.00	413.60	5307.30	47	0	4.08	19.6	73.30	\N
2026-01-08 09:47:17.285373+00	3472	9	matin	414.50	395.00	6377.40	44	0	2.22	19.8	59.90	\N
2026-01-08 09:47:47.332359+00	4516	9	soir	429.00	439.10	5436.10	46	0	6.12	20.1	56.50	\N
2026-01-08 09:48:17.343783+00	3472	10	matin	433.70	416.70	6544.20	42	0	6.67	22.7	66.10	\N
2026-01-08 09:48:47.388638+00	4516	10	soir	459.20	464.50	5561.90	46	0	6.12	19.3	69.30	\N
2026-01-08 09:49:17.415277+00	3472	11	matin	455.10	438.30	6702.60	42	0	6.67	22.7	68.70	\N
2026-01-08 09:49:47.476226+00	4516	11	soir	471.00	490.00	5681.50	46	0	6.12	21.0	66.40	\N
2026-01-08 09:50:17.512261+00	3474	12	matin	457.10	460.00	6851.60	42	0	10.64	20.6	59.10	\N
2026-01-08 09:50:47.544359+00	3472	12	soir	496.30	490.00	6931.60	42	0	6.67	22.5	70.70	\N
2026-01-08 09:51:23.335937+00	3474	0	matin	206.60	200.00	4606.00	46	0	0.00	19.6	71.30	\N
2026-01-08 09:51:53.355646+00	3474	0	soir	203.20	210.00	4714.60	46	0	0.00	21.7	67.00	\N
2026-01-08 09:52:23.38461+00	3474	1	matin	221.70	223.60	4821.70	46	0	0.00	20.9	74.40	\N
2026-01-08 09:52:53.411786+00	3487	1	soir	229.40	233.30	4942.90	48	0	2.04	21.9	61.20	\N
2026-01-08 09:53:23.464655+00	3473	2	matin	242.00	240.00	5047.00	55	0	0.00	22.2	58.80	\N
2026-01-08 09:53:53.503894+00	3474	2	soir	271.30	260.90	5140.10	46	0	0.00	20.3	59.80	\N
2026-01-08 09:54:23.538675+00	3487	3	matin	259.20	265.00	5255.90	48	0	2.04	21.6	68.40	\N
2026-01-08 09:54:53.595804+00	3473	3	soir	262.30	274.60	5359.70	54	0	1.82	22.5	71.30	\N
2026-01-08 09:55:23.616285+00	3487	4	matin	285.70	286.70	5458.60	46	0	6.12	21.0	55.60	\N
2026-01-08 09:55:53.651385+00	3473	4	soir	288.00	296.20	5563.90	54	0	1.82	23.0	61.20	\N
2026-01-08 09:56:23.685424+00	3487	5	matin	293.60	308.30	5655.10	45	0	8.16	19.3	73.50	\N
2026-01-08 09:56:53.735232+00	3473	5	soir	323.20	317.70	5758.20	54	0	1.82	19.1	62.10	\N
2026-01-08 09:40:16.806845+00	4516	2	matin	251.00	247.30	4334.20	49	0	0.00	19.9	60.50	\N
2026-01-08 09:40:46.841565+00	3472	2	soir	254.10	256.70	5154.40	45	0	0.00	19.8	57.40	\N
2026-01-08 09:41:16.89566+00	4516	3	matin	272.10	270.90	4499.30	48	0	2.04	22.2	60.10	\N
2026-01-08 09:41:46.901989+00	3472	3	soir	271.10	280.00	5358.30	44	0	2.22	22.7	63.10	\N
2026-01-08 09:42:16.937457+00	4516	4	matin	290.60	294.50	4658.50	48	0	2.04	19.7	72.40	\N
2026-01-08 09:42:46.946486+00	3472	4	soir	303.70	303.30	5559.10	44	0	2.22	21.7	70.30	\N
2026-01-08 09:43:16.989689+00	4516	5	matin	305.10	318.20	4811.60	48	0	2.04	22.3	68.10	\N
2026-01-08 09:43:47.019759+00	3472	5	soir	340.40	326.70	5753.20	44	0	2.22	19.8	57.80	\N
2026-01-08 09:44:17.057582+00	4516	6	matin	334.80	341.80	4960.40	47	0	4.08	21.4	65.60	\N
2026-01-08 09:44:47.099031+00	3472	6	soir	344.00	350.00	5942.50	44	0	2.22	20.9	59.20	\N
2026-01-08 09:45:17.127015+00	4516	7	matin	351.10	365.50	5102.10	47	0	4.08	19.9	64.80	\N
2026-01-08 09:45:47.16298+00	3474	7	soir	379.30	373.30	6116.30	45	0	4.26	21.7	66.70	\N
2026-01-08 09:46:17.193921+00	3474	8	matin	364.80	373.30	6208.10	45	0	4.26	22.6	57.60	\N
2026-01-08 09:46:47.250387+00	3474	8	soir	395.70	396.70	6295.10	45	0	4.26	22.0	56.60	\N
2026-01-08 09:47:17.29085+00	3474	9	matin	411.10	395.00	6380.00	45	0	4.26	20.5	69.10	\N
2026-01-08 09:47:47.329488+00	3474	9	soir	400.80	420.00	6464.90	45	0	4.26	22.9	70.30	\N
2026-01-08 09:48:17.361686+00	3474	10	matin	401.40	416.70	6545.00	45	0	4.26	19.3	65.20	\N
2026-01-08 09:48:47.38453+00	3474	10	soir	427.80	443.30	6623.70	44	0	6.38	19.9	64.30	\N
2026-01-08 09:49:17.424348+00	3474	11	matin	440.70	438.30	6703.30	43	0	8.51	20.6	55.60	\N
2026-01-08 09:49:47.471814+00	3474	11	soir	458.20	466.70	6781.70	43	0	8.51	19.7	69.20	\N
2026-01-08 09:50:17.509009+00	3472	12	matin	453.40	460.00	6856.90	42	0	6.67	21.0	70.50	\N
2026-01-08 09:50:47.550498+00	3474	12	soir	479.20	490.00	6925.30	42	0	10.64	21.0	65.80	\N
2026-01-08 09:51:23.255943+00	3487	0	matin	192.50	200.00	4611.00	49	0	0.00	20.3	73.20	\N
2026-01-08 09:51:53.361807+00	3473	0	soir	217.80	210.00	4722.10	55	0	0.00	21.4	63.50	\N
2026-01-08 09:52:23.378166+00	3487	1	matin	211.00	221.70	4831.70	48	0	2.04	22.0	68.70	\N
2026-01-08 09:52:53.422874+00	3473	1	soir	225.80	231.50	4939.50	55	0	0.00	21.9	72.20	\N
2026-01-08 09:53:23.461455+00	3474	2	matin	237.80	247.30	5037.60	46	0	0.00	20.3	67.10	\N
2026-01-08 09:53:53.496347+00	3487	2	soir	252.20	256.70	5153.10	48	0	2.04	21.9	60.00	\N
2026-01-08 09:54:23.552762+00	3473	3	matin	253.00	260.00	5256.60	54	0	1.82	19.9	64.20	\N
2026-01-08 09:54:53.589204+00	3487	3	soir	272.90	280.00	5360.80	47	0	4.08	19.5	66.80	\N
2026-01-08 09:55:23.625822+00	3473	4	matin	272.70	280.00	5462.40	54	0	1.82	20.1	64.60	\N
2026-01-08 09:55:53.641289+00	3487	4	soir	314.30	303.30	5557.60	45	0	8.16	22.0	63.60	\N
2026-01-08 09:56:23.691038+00	3473	5	matin	295.30	300.00	5660.80	54	0	1.82	19.3	62.40	\N
2026-01-08 09:56:53.728485+00	3474	5	soir	341.30	337.30	5733.20	46	0	0.00	20.0	58.30	\N
2026-01-08 09:57:23.768499+00	3487	6	matin	339.80	330.00	5845.70	45	0	8.16	20.1	67.50	\N
2026-01-08 09:57:53.799972+00	3473	6	soir	338.80	339.20	5947.60	54	0	1.82	21.7	70.40	\N
2026-01-08 09:58:23.835626+00	3487	7	matin	342.00	351.70	6028.40	45	0	8.16	22.3	69.40	\N
2026-01-08 09:58:53.864621+00	3473	7	soir	357.60	360.80	6136.10	54	0	1.82	21.0	62.90	\N
2026-01-08 09:59:23.872223+00	3487	8	matin	366.60	373.30	6205.70	45	0	8.16	19.3	55.20	\N
2026-01-08 09:59:53.919099+00	3473	8	soir	364.90	382.30	6310.80	54	0	1.82	21.8	63.70	\N
2026-01-08 10:00:23.952098+00	3487	9	matin	409.70	395.00	6380.40	45	0	8.16	22.8	59.60	\N
2026-01-08 10:00:53.976705+00	3473	9	soir	384.20	403.80	6482.50	54	0	1.82	20.6	65.30	\N
2026-01-08 10:01:24.015863+00	3474	10	matin	438.60	436.40	6506.10	45	0	2.17	19.9	59.10	\N
2026-01-08 10:01:54.036274+00	3474	10	soir	462.20	464.50	6583.20	45	0	2.17	22.0	67.40	\N
2026-01-08 10:02:24.077918+00	3474	11	matin	479.20	460.00	6659.10	45	0	2.17	19.4	61.90	\N
2026-01-08 10:02:54.11939+00	3474	11	soir	477.10	490.00	6733.80	45	0	2.17	20.1	61.40	\N
2026-01-08 10:03:24.165148+00	3473	12	matin	426.60	440.00	6886.90	54	0	1.82	20.1	69.10	\N
2026-01-08 10:03:54.203677+00	3487	12	soir	503.50	490.00	6937.00	45	0	8.16	21.7	58.10	\N
2026-01-08 10:05:30.112111+00	3488	0	matin	191.20	200.00	4616.70	55	0	0.00	21.8	56.10	\N
2026-01-08 10:06:00.134181+00	3488	0	soir	212.30	210.00	4732.40	55	0	0.00	21.9	66.60	\N
2026-01-08 10:06:30.173318+00	3488	1	matin	209.60	218.60	4842.80	55	0	0.00	22.2	61.10	\N
2026-01-08 10:07:00.189127+00	3488	1	soir	238.40	230.00	4954.10	55	0	0.00	20.6	59.40	\N
2026-01-08 10:07:30.202178+00	3472	2	matin	244.40	240.00	5042.60	52	0	0.00	19.6	56.40	\N
2026-01-08 10:08:00.240726+00	3489	2	soir	258.00	250.00	5173.80	55	0	0.00	20.5	73.20	\N
2026-01-08 10:08:30.267052+00	3472	3	matin	250.60	260.00	5249.80	52	0	0.00	22.5	70.90	\N
2026-01-08 10:09:00.308395+00	3489	3	soir	261.50	270.00	5380.00	55	0	0.00	19.6	59.20	\N
2026-01-08 10:09:30.342209+00	3472	4	matin	287.30	280.00	5453.40	52	0	0.00	19.1	64.90	\N
2026-01-08 09:57:23.773801+00	3474	6	matin	348.60	341.80	5826.30	46	0	0.00	21.3	59.00	\N
2026-01-08 09:57:53.793611+00	3474	6	soir	372.50	362.70	5917.70	46	0	0.00	22.9	68.40	\N
2026-01-08 09:58:23.839174+00	3474	7	matin	372.90	365.50	6008.10	46	0	0.00	21.2	66.00	\N
2026-01-08 09:58:53.859239+00	3474	7	soir	407.10	388.20	6096.90	46	0	0.00	22.0	57.00	\N
2026-01-08 09:59:23.875345+00	3474	8	matin	374.80	389.10	6180.60	46	0	0.00	22.8	65.50	\N
2026-01-08 09:59:53.914884+00	3474	8	soir	393.20	413.60	6264.00	46	0	0.00	22.3	68.00	\N
2026-01-08 10:00:23.955887+00	3474	9	matin	410.50	412.70	6345.50	45	0	2.17	21.4	71.20	\N
2026-01-08 10:00:53.972479+00	3474	9	soir	430.60	439.10	6427.10	45	0	2.17	22.0	61.10	\N
2026-01-08 10:01:24.008449+00	3487	10	matin	429.30	416.70	6547.60	45	0	8.16	22.8	60.70	\N
2026-01-08 10:01:54.040558+00	3473	10	soir	414.50	425.40	6648.60	54	0	1.82	20.8	71.70	\N
2026-01-08 10:02:24.074322+00	3487	11	matin	448.30	438.30	6708.40	45	0	8.16	22.1	62.70	\N
2026-01-08 10:02:54.123577+00	3473	11	soir	461.00	446.90	6809.20	54	0	1.82	20.5	55.50	\N
2026-01-08 10:03:24.156005+00	3487	12	matin	456.30	460.00	6861.60	45	0	8.16	22.2	67.30	\N
2026-01-08 10:03:54.208475+00	3473	12	soir	451.30	468.50	6964.40	54	0	1.82	20.5	59.30	\N
2026-01-08 10:04:24.22853+00	3473	13	matin	482.50	460.00	7039.60	54	0	1.82	22.2	66.10	\N
2026-01-08 10:04:54.239486+00	3473	13	soir	493.20	490.00	7115.00	54	0	1.82	22.9	65.00	\N
2026-01-08 10:05:30.048982+00	3472	0	matin	207.30	200.00	4607.80	52	0	0.00	22.4	63.70	\N
2026-01-08 10:06:00.138983+00	3489	0	soir	215.30	210.00	4738.80	55	0	0.00	20.8	71.10	\N
2026-01-08 10:06:30.169391+00	3472	1	matin	212.90	220.00	4827.10	52	0	0.00	22.8	67.60	\N
2026-01-08 10:07:00.196758+00	3489	1	soir	223.10	230.00	4959.30	55	0	0.00	20.5	73.90	\N
2026-01-08 10:07:30.207967+00	3488	2	matin	239.40	237.10	5061.80	55	0	0.00	21.7	73.60	\N
2026-01-08 10:08:00.237005+00	3488	2	soir	254.60	250.00	5170.60	55	0	0.00	21.1	69.10	\N
2026-01-08 10:08:30.274354+00	3488	3	matin	257.80	255.70	5272.90	55	0	0.00	20.9	59.70	\N
2026-01-08 10:09:00.303126+00	3488	3	soir	271.10	270.00	5380.70	54	0	1.82	20.4	73.40	\N
2026-01-08 10:09:30.347447+00	3488	4	matin	274.30	274.30	5486.00	54	0	1.82	22.5	63.10	\N
2026-01-08 09:57:23.779701+00	3473	6	matin	308.50	320.00	5854.00	54	0	1.82	20.5	67.00	\N
2026-01-08 09:57:53.787722+00	3487	6	soir	333.00	350.00	5938.30	45	0	8.16	20.9	59.90	\N
2026-01-08 09:58:23.8417+00	3473	7	matin	335.40	340.00	6040.60	54	0	1.82	20.7	61.20	\N
2026-01-08 09:58:53.852028+00	3487	7	soir	364.00	373.30	6119.80	45	0	8.16	20.3	55.30	\N
2026-01-08 09:59:23.878418+00	3473	8	matin	350.20	360.00	6223.40	54	0	1.82	22.5	61.10	\N
2026-01-08 09:59:53.910474+00	3487	8	soir	380.50	396.70	6294.70	45	0	8.16	23.0	57.70	\N
2026-01-08 10:00:23.958691+00	3473	9	matin	394.00	380.00	6398.40	54	0	1.82	20.3	55.50	\N
2026-01-08 10:00:53.966883+00	3487	9	soir	410.80	420.00	6466.50	45	0	8.16	20.9	59.80	\N
2026-01-08 10:01:24.020829+00	3473	10	matin	385.70	400.00	6565.00	54	0	1.82	20.6	61.00	\N
2026-01-08 10:01:54.03057+00	3487	10	soir	447.60	443.30	6627.80	45	0	8.16	21.4	63.00	\N
2026-01-08 10:02:24.080845+00	3473	11	matin	412.90	420.00	6728.60	54	0	1.82	22.0	62.50	\N
2026-01-08 10:02:54.114971+00	3487	11	soir	479.30	466.70	6787.10	45	0	8.16	20.6	57.20	\N
2026-01-08 10:05:30.115032+00	3489	0	matin	199.50	200.00	4625.40	55	0	0.00	19.5	61.90	\N
2026-01-08 10:06:00.126984+00	3472	0	soir	212.20	210.00	4719.90	52	0	0.00	19.1	57.50	\N
2026-01-08 10:06:30.177138+00	3489	1	matin	227.50	218.60	4851.10	55	0	0.00	20.3	61.30	\N
2026-01-08 10:07:00.180421+00	3472	1	soir	233.20	231.50	4935.20	52	0	0.00	19.4	70.20	\N
2026-01-08 10:07:30.210728+00	3489	2	matin	243.60	237.10	5067.50	55	0	0.00	22.4	57.20	\N
2026-01-08 10:08:00.230739+00	3472	2	soir	252.60	253.10	5148.80	52	0	0.00	20.0	60.10	\N
2026-01-08 10:08:30.281677+00	3489	3	matin	258.30	255.70	5277.20	55	0	0.00	20.7	60.60	\N
2026-01-08 10:09:00.291182+00	3472	3	soir	279.30	274.60	5353.30	52	0	0.00	20.2	64.20	\N
2026-01-08 10:09:30.350879+00	3489	4	matin	286.30	274.30	5481.60	55	0	0.00	20.2	71.20	\N
2026-01-08 08:56:26.358064+00	3474	1	soir	245.60	235.50	4942.50	49	0	0.00	21.2	71.40	\N
2026-01-08 08:56:56.39112+00	3487	2	matin	235.80	247.30	4345.80	50	0	0.00	22.8	62.60	\N
2026-01-08 08:57:26.438554+00	4516	2	soir	258.90	256.70	5160.90	54	0	0.00	21.1	72.40	\N
2026-01-08 08:57:56.474471+00	3487	3	matin	264.90	270.90	4512.80	50	0	0.00	20.1	67.20	\N
2026-01-08 08:58:26.529449+00	4516	3	soir	268.80	280.00	5369.70	54	0	0.00	19.4	72.60	\N
2026-01-08 08:58:56.560355+00	3487	4	matin	291.50	294.50	4673.00	50	0	0.00	22.5	72.90	\N
2026-01-08 08:59:26.607489+00	4516	4	soir	305.70	303.30	5567.50	54	0	0.00	20.7	56.70	\N
2026-01-08 08:59:56.631965+00	3487	5	matin	304.90	318.20	4829.90	50	0	0.00	20.5	73.80	\N
2026-01-08 09:00:26.684926+00	4516	5	soir	341.70	326.70	5757.90	54	0	0.00	20.8	58.60	\N
2026-01-08 09:00:56.689176+00	3487	6	matin	341.40	341.80	4978.20	50	0	0.00	22.5	73.80	\N
2026-01-08 09:01:26.735504+00	4516	6	soir	345.30	350.00	5947.90	53	0	1.85	21.3	69.60	\N
2026-01-08 09:01:56.764988+00	3487	7	matin	382.40	365.50	5125.20	50	0	0.00	19.5	57.80	\N
2026-01-08 09:01:56.780855+00	4516	7	matin	363.90	351.70	6040.50	53	0	1.85	22.4	62.10	\N
2026-01-08 09:02:26.827773+00	3487	7	soir	378.60	388.20	5196.70	50	0	0.00	19.1	61.90	\N
2026-01-08 09:02:56.858021+00	4516	8	matin	364.10	373.30	6213.00	53	0	1.85	22.1	71.80	\N
2026-01-08 09:03:26.866411+00	3487	8	soir	400.90	413.60	5333.20	50	0	0.00	20.3	68.20	\N
2026-01-08 09:03:56.895796+00	4516	9	matin	403.70	395.00	6383.90	53	0	1.85	21.4	58.30	\N
2026-01-08 09:04:26.929958+00	3487	9	soir	450.50	439.10	5465.30	50	0	0.00	20.2	70.90	\N
2026-01-08 09:04:56.985736+00	4516	10	matin	437.10	416.70	6550.80	53	0	1.85	19.7	74.20	\N
2026-01-08 09:05:27.032674+00	3474	10	soir	481.50	464.50	6603.20	48	0	2.04	22.8	70.10	\N
2026-01-08 09:05:57.089204+00	3474	11	matin	465.00	460.00	6677.40	48	0	2.04	20.2	69.30	\N
2026-01-08 09:06:27.118328+00	3474	11	soir	499.20	490.00	6751.80	47	0	4.08	22.7	63.90	\N
2026-01-08 09:08:02.983882+00	3488	0	matin	191.30	200.00	4622.70	55	0	0.00	19.4	74.20	\N
2026-01-08 09:08:32.99583+00	3472	0	soir	203.40	210.00	4073.40	51	0	0.00	19.6	72.40	\N
\.


--
-- Data for Name: _hyper_5_2_chunk; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._hyper_5_2_chunk ("time", canard_id, dose_matin, dose_soir, dose_theorique_matin, dose_theorique_soir, heure_gavage_matin, heure_gavage_soir, poids_matin, poids_soir, temperature_stabule, humidite_stabule, qualite_air_co2, luminosite, lot_mais_id, remarques, comportement_observe, etat_sanitaire, correction_proposee, ecart_dose_matin, ecart_dose_soir, alerte_generee, poids_actuel) FROM stdin;
\.


--
-- Data for Name: _hyper_5_3_chunk; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._hyper_5_3_chunk ("time", canard_id, dose_matin, dose_soir, dose_theorique_matin, dose_theorique_soir, heure_gavage_matin, heure_gavage_soir, poids_matin, poids_soir, temperature_stabule, humidite_stabule, qualite_air_co2, luminosite, lot_mais_id, remarques, comportement_observe, etat_sanitaire, correction_proposee, ecart_dose_matin, ecart_dose_soir, alerte_generee, poids_actuel) FROM stdin;
2025-12-25 00:00:00+00	1	397.25	464.26	350.00	425.00	08:00:00	18:00:00	3822.12	3854.49	23.5	54.17	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	1	399.52	514.26	380.00	460.00	08:00:00	18:00:00	3984.25	4080.36	25.6	63.58	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	2	353.14	465.62	350.00	425.00	08:00:00	18:00:00	3888.00	3980.34	24.2	51.51	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	2	383.38	464.33	380.00	460.00	08:00:00	18:00:00	4002.75	4107.66	21.9	72.23	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	3	385.33	450.95	350.00	425.00	08:00:00	18:00:00	3957.82	4028.08	24.7	75.08	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	3	381.60	492.24	380.00	460.00	08:00:00	18:00:00	4123.35	4106.66	25.7	54.48	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	4	376.89	478.73	350.00	425.00	08:00:00	18:00:00	3962.07	4053.51	25.8	78.19	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	4	382.81	500.84	380.00	460.00	08:00:00	18:00:00	4115.50	4162.97	21.1	68.77	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	5	390.54	434.35	350.00	425.00	08:00:00	18:00:00	4032.88	4120.45	20.3	65.71	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	5	408.40	476.54	380.00	460.00	08:00:00	18:00:00	4179.98	4264.81	20.9	54.79	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	6	386.44	439.18	350.00	425.00	08:00:00	18:00:00	4092.22	4168.66	20.0	66.92	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	6	386.28	511.39	380.00	460.00	08:00:00	18:00:00	4232.41	4326.58	24.2	59.48	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	7	363.70	434.47	350.00	425.00	08:00:00	18:00:00	4100.10	4177.49	24.2	66.99	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	7	391.45	467.18	380.00	460.00	08:00:00	18:00:00	4298.74	4356.08	18.1	53.54	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	8	351.39	446.31	350.00	425.00	08:00:00	18:00:00	4237.68	4267.26	21.0	60.81	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	8	409.59	516.15	380.00	460.00	08:00:00	18:00:00	4304.98	4401.24	18.2	53.18	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	9	389.67	466.06	350.00	425.00	08:00:00	18:00:00	4274.42	4288.03	24.1	51.57	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	9	427.26	515.43	380.00	460.00	08:00:00	18:00:00	4447.82	4447.90	23.4	51.76	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	10	351.09	428.27	350.00	425.00	08:00:00	18:00:00	4343.33	4327.84	24.8	69.43	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	10	384.79	485.87	380.00	460.00	08:00:00	18:00:00	4400.61	4504.74	22.7	60.37	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	11	357.73	437.77	350.00	425.00	08:00:00	18:00:00	3897.96	3943.00	24.4	59.02	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	11	403.27	488.31	380.00	460.00	08:00:00	18:00:00	3973.51	4091.98	21.3	63.24	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	12	389.35	475.84	350.00	425.00	08:00:00	18:00:00	3859.27	3924.76	22.1	62.84	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	12	385.77	482.04	380.00	460.00	08:00:00	18:00:00	4041.81	4096.32	24.6	57.93	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	13	399.92	448.67	350.00	425.00	08:00:00	18:00:00	3998.46	3985.69	21.2	74.38	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	13	393.93	487.87	380.00	460.00	08:00:00	18:00:00	4096.79	4145.19	22.7	75.54	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	14	386.06	474.91	350.00	425.00	08:00:00	18:00:00	4031.90	4023.74	22.8	51.29	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	14	404.68	482.07	380.00	460.00	08:00:00	18:00:00	4148.22	4233.15	19.0	76.02	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	15	393.32	440.92	350.00	425.00	08:00:00	18:00:00	4012.00	4131.74	22.1	56.52	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	15	422.23	515.53	380.00	460.00	08:00:00	18:00:00	4170.84	4251.10	19.7	56.40	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	16	354.15	466.12	350.00	425.00	08:00:00	18:00:00	4058.77	4141.28	18.7	55.12	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	16	401.97	467.86	380.00	460.00	08:00:00	18:00:00	4288.75	4277.97	18.1	57.49	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	17	389.72	434.89	350.00	425.00	08:00:00	18:00:00	4126.62	4219.57	23.7	72.32	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	17	407.34	493.85	380.00	460.00	08:00:00	18:00:00	4298.63	4375.61	23.1	75.53	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	18	370.03	454.87	350.00	425.00	08:00:00	18:00:00	4236.47	4238.89	21.7	60.04	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	18	383.34	489.45	380.00	460.00	08:00:00	18:00:00	4370.32	4417.12	19.4	61.94	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	19	396.31	458.51	350.00	425.00	08:00:00	18:00:00	4223.73	4300.01	22.8	52.26	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	19	406.99	468.31	380.00	460.00	08:00:00	18:00:00	4442.08	4488.32	25.4	72.89	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	20	369.00	440.37	350.00	425.00	08:00:00	18:00:00	4266.36	4336.83	18.2	78.01	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	20	414.64	496.91	380.00	460.00	08:00:00	18:00:00	4421.85	4456.20	23.0	79.23	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	21	357.74	435.46	350.00	425.00	08:00:00	18:00:00	3820.60	3864.28	23.0	72.48	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	21	428.77	506.63	380.00	460.00	08:00:00	18:00:00	3957.63	4020.88	24.6	59.32	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	22	387.69	444.92	350.00	425.00	08:00:00	18:00:00	3912.82	3955.23	18.5	52.92	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	22	387.36	461.56	380.00	460.00	08:00:00	18:00:00	4055.63	4082.75	20.6	67.35	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	23	370.53	429.51	350.00	425.00	08:00:00	18:00:00	3948.56	4017.26	22.7	50.05	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	23	425.40	503.81	380.00	460.00	08:00:00	18:00:00	4087.32	4137.45	21.5	64.86	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	24	357.39	437.70	350.00	425.00	08:00:00	18:00:00	4036.52	4072.18	23.9	75.93	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	24	414.44	512.94	380.00	460.00	08:00:00	18:00:00	4190.32	4170.48	24.9	60.32	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-25 00:00:00+00	25	382.72	445.07	350.00	425.00	08:00:00	18:00:00	4043.74	4062.56	20.7	79.51	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
2025-12-26 00:00:00+00	25	422.78	506.38	380.00	460.00	08:00:00	18:00:00	4168.01	4267.11	20.9	70.39	\N	\N	1	\N	\N	\N	\N	\N	\N	f	\N
\.


--
-- Data for Name: _hyper_7_4_chunk; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._hyper_7_4_chunk (day, canard_id, poids_moyen_matin, poids_moyen_soir, gain_poids_moyen, dose_totale_jour, temperature_moyenne, humidite_moyenne, nb_mesures) FROM stdin;
2025-12-25 00:00:00+00	1	3822.1200000000000000	3854.4900000000000000	32.3700000000000000	861.51	23.5000000000000000	54.1700000000000000	1
2025-12-25 00:00:00+00	2	3888.0000000000000000	3980.3400000000000000	92.3400000000000000	818.76	24.2000000000000000	51.5100000000000000	1
2025-12-25 00:00:00+00	3	3957.8200000000000000	4028.0800000000000000	70.2600000000000000	836.28	24.7000000000000000	75.0800000000000000	1
2025-12-25 00:00:00+00	4	3962.0700000000000000	4053.5100000000000000	91.4400000000000000	855.62	25.8000000000000000	78.1900000000000000	1
2025-12-25 00:00:00+00	5	4032.8800000000000000	4120.4500000000000000	87.5700000000000000	824.89	20.3000000000000000	65.7100000000000000	1
2025-12-25 00:00:00+00	6	4092.2200000000000000	4168.6600000000000000	76.4400000000000000	825.62	20.0000000000000000	66.9200000000000000	1
2025-12-25 00:00:00+00	7	4100.1000000000000000	4177.4900000000000000	77.3900000000000000	798.17	24.2000000000000000	66.9900000000000000	1
2025-12-25 00:00:00+00	8	4237.6800000000000000	4267.2600000000000000	29.5800000000000000	797.70	21.0000000000000000	60.8100000000000000	1
2025-12-25 00:00:00+00	9	4274.4200000000000000	4288.0300000000000000	13.6100000000000000	855.73	24.1000000000000000	51.5700000000000000	1
2025-12-25 00:00:00+00	10	4343.3300000000000000	4327.8400000000000000	-15.4900000000000000	779.36	24.8000000000000000	69.4300000000000000	1
2025-12-25 00:00:00+00	11	3897.9600000000000000	3943.0000000000000000	45.0400000000000000	795.50	24.4000000000000000	59.0200000000000000	1
2025-12-25 00:00:00+00	12	3859.2700000000000000	3924.7600000000000000	65.4900000000000000	865.19	22.1000000000000000	62.8400000000000000	1
2025-12-25 00:00:00+00	13	3998.4600000000000000	3985.6900000000000000	-12.7700000000000000	848.59	21.2000000000000000	74.3800000000000000	1
2025-12-25 00:00:00+00	14	4031.9000000000000000	4023.7400000000000000	-8.1600000000000000	860.97	22.8000000000000000	51.2900000000000000	1
2025-12-25 00:00:00+00	15	4012.0000000000000000	4131.7400000000000000	119.7400000000000000	834.24	22.1000000000000000	56.5200000000000000	1
2025-12-25 00:00:00+00	16	4058.7700000000000000	4141.2800000000000000	82.5100000000000000	820.27	18.7000000000000000	55.1200000000000000	1
2025-12-25 00:00:00+00	17	4126.6200000000000000	4219.5700000000000000	92.9500000000000000	824.61	23.7000000000000000	72.3200000000000000	1
2025-12-25 00:00:00+00	18	4236.4700000000000000	4238.8900000000000000	2.4200000000000000	824.90	21.7000000000000000	60.0400000000000000	1
2025-12-25 00:00:00+00	19	4223.7300000000000000	4300.0100000000000000	76.2800000000000000	854.82	22.8000000000000000	52.2600000000000000	1
2025-12-25 00:00:00+00	20	4266.3600000000000000	4336.8300000000000000	70.4700000000000000	809.37	18.2000000000000000	78.0100000000000000	1
2025-12-25 00:00:00+00	21	3820.6000000000000000	3864.2800000000000000	43.6800000000000000	793.20	23.0000000000000000	72.4800000000000000	1
2025-12-25 00:00:00+00	22	3912.8200000000000000	3955.2300000000000000	42.4100000000000000	832.61	18.5000000000000000	52.9200000000000000	1
2025-12-25 00:00:00+00	23	3948.5600000000000000	4017.2600000000000000	68.7000000000000000	800.04	22.7000000000000000	50.0500000000000000	1
2025-12-25 00:00:00+00	24	4036.5200000000000000	4072.1800000000000000	35.6600000000000000	795.09	23.9000000000000000	75.9300000000000000	1
2025-12-25 00:00:00+00	25	4043.7400000000000000	4062.5600000000000000	18.8200000000000000	827.79	20.7000000000000000	79.5100000000000000	1
2025-12-24 00:00:00+00	1	3689.9000000000000000	3700.2000000000000000	10.3000000000000000	757.78	19.1000000000000000	58.8300000000000000	1
2025-12-24 00:00:00+00	2	3702.7600000000000000	3758.3300000000000000	55.5700000000000000	734.25	23.3000000000000000	76.8300000000000000	1
2025-12-24 00:00:00+00	3	3807.7500000000000000	3885.9000000000000000	78.1500000000000000	767.91	22.5000000000000000	68.0900000000000000	1
2025-12-24 00:00:00+00	4	3850.2900000000000000	3862.6700000000000000	12.3800000000000000	764.36	23.0000000000000000	63.5600000000000000	1
2025-12-24 00:00:00+00	5	3891.3300000000000000	3913.7200000000000000	22.3900000000000000	780.15	23.3000000000000000	70.3500000000000000	1
2025-12-24 00:00:00+00	6	3955.9900000000000000	3973.0900000000000000	17.1000000000000000	742.66	25.4000000000000000	78.1100000000000000	1
2025-12-24 00:00:00+00	7	4009.7500000000000000	4074.5400000000000000	64.7900000000000000	764.94	24.0000000000000000	69.7700000000000000	1
2025-12-24 00:00:00+00	8	4011.5000000000000000	4131.8100000000000000	120.3100000000000000	774.66	20.9000000000000000	58.6100000000000000	1
2025-12-24 00:00:00+00	9	4050.8900000000000000	4172.1800000000000000	121.2900000000000000	765.79	21.4000000000000000	63.1500000000000000	1
2025-12-24 00:00:00+00	10	4155.1800000000000000	4212.1200000000000000	56.9400000000000000	720.29	23.6000000000000000	53.4500000000000000	1
2025-12-24 00:00:00+00	11	3650.4600000000000000	3768.3700000000000000	117.9100000000000000	782.67	18.7000000000000000	66.4900000000000000	1
2025-12-24 00:00:00+00	12	3731.9000000000000000	3844.3800000000000000	112.4800000000000000	784.06	22.8000000000000000	73.3600000000000000	1
2025-12-24 00:00:00+00	13	3820.0100000000000000	3834.3100000000000000	14.3000000000000000	762.54	25.4000000000000000	61.2400000000000000	1
2025-12-24 00:00:00+00	14	3887.4000000000000000	3941.2700000000000000	53.8700000000000000	760.65	25.4000000000000000	70.9600000000000000	1
2025-12-24 00:00:00+00	15	3880.9800000000000000	3940.5300000000000000	59.5500000000000000	781.23	23.2000000000000000	75.6000000000000000	1
2025-12-24 00:00:00+00	16	3977.9100000000000000	3966.9200000000000000	-10.9900000000000000	735.81	22.9000000000000000	58.3100000000000000	1
2025-12-24 00:00:00+00	17	4016.3800000000000000	4049.6700000000000000	33.2900000000000000	764.96	25.3000000000000000	69.4500000000000000	1
2025-12-24 00:00:00+00	18	4093.4800000000000000	4109.4200000000000000	15.9400000000000000	760.65	19.7000000000000000	78.1000000000000000	1
2025-12-24 00:00:00+00	19	4148.9400000000000000	4105.3700000000000000	-43.5700000000000000	815.22	18.7000000000000000	53.7000000000000000	1
2025-12-24 00:00:00+00	20	4126.7000000000000000	4219.6700000000000000	92.9700000000000000	796.33	23.4000000000000000	60.1600000000000000	1
2025-12-24 00:00:00+00	21	3686.8800000000000000	3745.8700000000000000	58.9900000000000000	731.00	23.8000000000000000	74.4300000000000000	1
2025-12-24 00:00:00+00	22	3792.2500000000000000	3845.9200000000000000	53.6700000000000000	799.40	20.1000000000000000	57.1200000000000000	1
2025-12-24 00:00:00+00	23	3801.1400000000000000	3874.8700000000000000	73.7300000000000000	801.28	22.4000000000000000	67.0600000000000000	1
2025-12-24 00:00:00+00	24	3868.2400000000000000	3877.6700000000000000	9.4300000000000000	760.91	21.1000000000000000	76.3300000000000000	1
2025-12-24 00:00:00+00	25	3922.1100000000000000	3995.1800000000000000	73.0700000000000000	817.40	24.8000000000000000	51.5000000000000000	1
2025-12-26 00:00:00+00	1	3984.2500000000000000	4080.3600000000000000	96.1100000000000000	913.78	25.6000000000000000	63.5800000000000000	1
2025-12-26 00:00:00+00	2	4002.7500000000000000	4107.6600000000000000	104.9100000000000000	847.71	21.9000000000000000	72.2300000000000000	1
2025-12-26 00:00:00+00	3	4123.3500000000000000	4106.6600000000000000	-16.6900000000000000	873.84	25.7000000000000000	54.4800000000000000	1
2025-12-26 00:00:00+00	4	4115.5000000000000000	4162.9700000000000000	47.4700000000000000	883.65	21.1000000000000000	68.7700000000000000	1
2025-12-26 00:00:00+00	5	4179.9800000000000000	4264.8100000000000000	84.8300000000000000	884.94	20.9000000000000000	54.7900000000000000	1
2025-12-26 00:00:00+00	6	4232.4100000000000000	4326.5800000000000000	94.1700000000000000	897.67	24.2000000000000000	59.4800000000000000	1
2025-12-26 00:00:00+00	7	4298.7400000000000000	4356.0800000000000000	57.3400000000000000	858.63	18.1000000000000000	53.5400000000000000	1
2025-12-26 00:00:00+00	8	4304.9800000000000000	4401.2400000000000000	96.2600000000000000	925.74	18.2000000000000000	53.1800000000000000	1
2025-12-26 00:00:00+00	9	4447.8200000000000000	4447.9000000000000000	0.08000000000000000000	942.69	23.4000000000000000	51.7600000000000000	1
2025-12-26 00:00:00+00	10	4400.6100000000000000	4504.7400000000000000	104.1300000000000000	870.66	22.7000000000000000	60.3700000000000000	1
2025-12-26 00:00:00+00	11	3973.5100000000000000	4091.9800000000000000	118.4700000000000000	891.58	21.3000000000000000	63.2400000000000000	1
2025-12-26 00:00:00+00	12	4041.8100000000000000	4096.3200000000000000	54.5100000000000000	867.81	24.6000000000000000	57.9300000000000000	1
2025-12-26 00:00:00+00	13	4096.7900000000000000	4145.1900000000000000	48.4000000000000000	881.80	22.7000000000000000	75.5400000000000000	1
2025-12-26 00:00:00+00	14	4148.2200000000000000	4233.1500000000000000	84.9300000000000000	886.75	19.0000000000000000	76.0200000000000000	1
2025-12-26 00:00:00+00	15	4170.8400000000000000	4251.1000000000000000	80.2600000000000000	937.76	19.7000000000000000	56.4000000000000000	1
2025-12-26 00:00:00+00	16	4288.7500000000000000	4277.9700000000000000	-10.7800000000000000	869.83	18.1000000000000000	57.4900000000000000	1
2025-12-26 00:00:00+00	17	4298.6300000000000000	4375.6100000000000000	76.9800000000000000	901.19	23.1000000000000000	75.5300000000000000	1
2025-12-26 00:00:00+00	18	4370.3200000000000000	4417.1200000000000000	46.8000000000000000	872.79	19.4000000000000000	61.9400000000000000	1
2025-12-26 00:00:00+00	19	4442.0800000000000000	4488.3200000000000000	46.2400000000000000	875.30	25.4000000000000000	72.8900000000000000	1
2025-12-26 00:00:00+00	20	4421.8500000000000000	4456.2000000000000000	34.3500000000000000	911.55	23.0000000000000000	79.2300000000000000	1
2025-12-26 00:00:00+00	21	3957.6300000000000000	4020.8800000000000000	63.2500000000000000	935.40	24.6000000000000000	59.3200000000000000	1
2025-12-26 00:00:00+00	22	4055.6300000000000000	4082.7500000000000000	27.1200000000000000	848.92	20.6000000000000000	67.3500000000000000	1
2025-12-26 00:00:00+00	23	4087.3200000000000000	4137.4500000000000000	50.1300000000000000	929.21	21.5000000000000000	64.8600000000000000	1
2025-12-26 00:00:00+00	24	4190.3200000000000000	4170.4800000000000000	-19.8400000000000000	927.38	24.9000000000000000	60.3200000000000000	1
2025-12-26 00:00:00+00	25	4168.0100000000000000	4267.1100000000000000	99.1000000000000000	929.16	20.9000000000000000	70.3900000000000000	1
\.


--
-- Data for Name: _hyper_9_1_chunk; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._hyper_9_1_chunk ("time", canard_id, niveau, type_alerte, message, valeur_mesuree, valeur_seuil, sms_envoye, acquittee, acquittee_par, acquittee_le) FROM stdin;
2025-12-26 08:57:46.439705+00	1	info	temperature	Alerte générée automatiquement pour test	95.50	100.00	f	f	\N	\N
2025-12-26 08:57:46.439705+00	2	critique	temperature	Alerte générée automatiquement pour test	95.50	100.00	f	f	\N	\N
2025-12-26 08:57:46.439705+00	3	important	temperature	Alerte générée automatiquement pour test	95.50	100.00	f	f	\N	\N
2025-12-26 08:57:46.439705+00	4	important	poids_faible	Alerte générée automatiquement pour test	95.50	100.00	f	f	\N	\N
2025-12-26 08:57:46.439705+00	5	important	poids_faible	Alerte générée automatiquement pour test	95.50	100.00	f	f	\N	\N
2025-12-26 08:59:01.721584+00	1	important	temperature	Alerte générée automatiquement pour test	95.50	100.00	f	f	\N	\N
2025-12-26 08:59:01.721584+00	2	important	poids_faible	Alerte générée automatiquement pour test	95.50	100.00	f	f	\N	\N
2025-12-26 08:59:01.721584+00	3	critique	temperature	Alerte générée automatiquement pour test	95.50	100.00	f	f	\N	\N
2025-12-26 08:59:01.721584+00	4	important	temperature	Alerte générée automatiquement pour test	95.50	100.00	f	f	\N	\N
2025-12-26 08:59:01.721584+00	5	important	poids_faible	Alerte générée automatiquement pour test	95.50	100.00	f	f	\N	\N
\.


--
-- Data for Name: _materialized_hypertable_14; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._materialized_hypertable_14 (bucket, lot_id, site_code, daily_feedbacks, avg_overall_rating, avg_texture_rating, avg_flavor_rating, avg_freshness_rating, recommendation_rate_pct, satisfaction_rate_pct) FROM stdin;
\.


--
-- Data for Name: _materialized_hypertable_15; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._materialized_hypertable_15 (bucket, site_code, weekly_feedbacks, avg_overall_rating, avg_texture_rating, avg_flavor_rating, avg_color_rating, avg_aroma_rating, avg_freshness_rating, recommendation_rate_pct, satisfaction_rate_pct, nps_score) FROM stdin;
\.


--
-- Data for Name: _materialized_hypertable_17; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._materialized_hypertable_17 (bucket, device_id, sample_count, count_a_plus, count_a, count_b, count_c, count_reject, avg_quality_score, min_quality_score, max_quality_score, avg_freshness, avg_fat_quality, avg_oxidation, avg_volume, avg_uniformity, count_compliant, last_refresh) FROM stdin;
\.


--
-- Data for Name: _materialized_hypertable_18; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._materialized_hypertable_18 (day, site_code, sample_count, count_a_plus, avg_quality_score, avg_freshness, compliance_rate_pct, last_refresh) FROM stdin;
\.


--
-- Data for Name: _materialized_hypertable_23; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._materialized_hypertable_23 (lot_id, jour, poids_moyen, dose_moyenne, temperature_moyenne, humidite_moyenne, ecart_moyen, mortalite_totale, nombre_enregistrements, nombre_alertes) FROM stdin;
\.


--
-- Data for Name: _materialized_hypertable_7; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._materialized_hypertable_7 (day, canard_id, poids_moyen_matin, poids_moyen_soir, gain_poids_moyen, dose_totale_jour, temperature_moyenne, humidite_moyenne, nb_mesures) FROM stdin;
\.


--
-- Data for Name: _materialized_hypertable_8; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal._materialized_hypertable_8 (week, genetique, nombre_canards, gain_poids_moyen, dose_moyenne_totale, temperature_moyenne) FROM stdin;
\.


--
-- Data for Name: compress_hyper_6_23_chunk; Type: TABLE DATA; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

COPY _timescaledb_internal.compress_hyper_6_23_chunk (_ts_meta_count, canard_id, _ts_meta_min_1, _ts_meta_max_1, "time", dose_matin, dose_soir, dose_theorique_matin, dose_theorique_soir, heure_gavage_matin, heure_gavage_soir, poids_matin, poids_soir, temperature_stabule, humidite_stabule, qualite_air_co2, luminosite, lot_mais_id, remarques, comportement_observe, etat_sanitaire, correction_proposee, ecart_dose_matin, ecart_dose_soir, _ts_meta_v2_min_alerte_generee, _ts_meta_v2_max_alerte_generee, alerte_generee, poids_actuel) FROM stdin;
5	1	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAUkR+AAAAAwAAgAAAAAAAgFGG1gAAAAMAAIAAAAAAAIBIB4UAAAADAACAAAAAAACAPchmAAAAAwAAgAAAAAAAgDSCow=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAawMgAAAAAwAAgAAAAAAAgFnHbAAAAAMAAIAAAAAAAIBXRPsAAAADAACAAAAAAACAVMDIAAAAAwAAgAAAAAAAgEVFRg=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDmkjKAAAAAwAAgAAAAAAAg4KAGQAAAAMAAIAAAAAAAINaQu4AAAADAACAAAAAAACDL0BkAAAAAwAAgAAAAAAAgwdBqQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDnQH0AAAAAwAAgAAAAAAAg3mFLQAAAAMAAIAAAAAAAINVAXcAAAADAACAAAAAAACDMUkVAAAAAwAAgAAAAAAAgx0EAQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABMD6AAAAAwAAgAAAAAAAQAWE4gAAAAKAAEAAAAAAAEAGQAAAAwAAgAAAAAAAQAYG1gAAAAMAAIAAAAAAAEAFCMo	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACADogbAAAAAwAAgAAAAAAAgA4GcgAAAAMAAIAAAAAAAIAPBu8AAAADAACAAAAAAACAEUeeAAAAAwAAgAAAAAAAgBFArw=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	2	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAUABLAAAAAwAAgAAAAAAAgE7FkQAAAAMAAIAAAAAAAIBFB54AAAADAACAAAAAAACAQgRMAAAAAwAAgAAAAAAAgDIAGQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAZ4ImAAAAAwAAgAAAAAAAgFyEGgAAAAMAAIAAAAAAAIBeh54AAAADAACAAAAAAACAUUOdAAAAAwAAgAAAAAAAgEhETA=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDnYdsAAAAAwAAgAAAAAAAg3pIsQAAAAMAAIAAAAAAAINoRyEAAAADAACAAAAAAACDL4QaAAAAAwAAgAAAAAAAgxnDnQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDq4M5AAAAAwAAgAAAAAAAg4fJYAAAAAMAAIAAAAAAAINlRBoAAAADAACAAAAAAACDPsR+AAAAAwAAgAAAAAAAgymJqw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABcLuAAAAAwAAgAAAAAAAQAYG1gAAAAKAAEAAAAAAAEAEwAAAAwAAgAAAAAAAQAXF3AAAAAMAAIAAAAAAAEAGCMo	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAEwgbAAAAAwAAgAAAAAAAgBKCJgAAAAMAAIAAAAAAAIAOQV4AAAADAACAAAAAAACADwKKAAAAAwAAgAAAAAAAgBOE4g=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	3	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAUUGQAAAAAwAAgAAAAAAAgFGEZQAAAAMAAIAAAAAAAIBIhkAAAAADAACAAAAAAACAQMmrAAAAAwAAgAAAAAAAgDYJRw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAbodTAAAAAwAAgAAAAAAAgGeEyQAAAAMAAIAAAAAAAIBcBZEAAAADAACAAAAAAACASEcIAAAAAwAAgAAAAAAAgD9BRQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDt8dTAAAAAwAAgAAAAAAAg46BRQAAAAMAAIAAAAAAAINnx7cAAAADAACAAAAAAACDTcRMAAAAAwAAgAAAAAAAgx4Ifw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDy0jKAAAAAwAAgAAAAAAAg6SHUwAAAAMAAIAAAAAAAIOAQqMAAAADAACAAAAAAACDXkKKAAAAAwAAgAAAAAAAgzKGpA=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABYTiAAAAAwAAgAAAAAAAQAZE4gAAAAMAAIAAAAAAAEAGB9AAAAADAACAAAAAAABABMfQAAAAAwAAgAAAAAAAQAXC7g=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAEQDhAAAAAwAAgAAAAAAAgBOAGQAAAAMAAIAAAAAAAIANQK8AAAADAACAAAAAAACAEcixAAAAAwAAgAAAAAAAgA0HIQ=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	4	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAUIbWAAAAAwAAgAAAAAAAgE7JLgAAAAMAAIAAAAAAAIBCwnEAAAADAACAAAAAAACAPEbvAAAAAwAAgAAAAAAAgDgIGw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAbkZyAAAAAwAAgAAAAAAAgFjFeAAAAAMAAIAAAAAAAIBUCH8AAAADAACAAAAAAACATQiYAAAAAwAAgAAAAAAAgEcETA=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDwoLVAAAAAwAAgAAAAAAAg6bEyQAAAAMAAIAAAAAAAIOBBlkAAAADAACAAAAAAACDVUeeAAAAAwAAgAAAAAAAgymJYA=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDxYaLAAAAAwAAgAAAAAAAg6iHOgAAAAMAAIAAAAAAAIONxDMAAAADAACAAAAAAACDV8jjAAAAAwAAgAAAAAAAg0FAGQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAABABcAAAAMAAIAAAAAAAEAFQ+gAAAADAACAAAAAAABABUXcAAAAAwAAgAAAAAAAQAYE4gAAAAMAAIAAAAAAAEAFBtY	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAD8V4AAAAAwAAgAAAAAAAgBNJqwAAAAMAAIAAAAAAAIANSH8AAAADAACAAAAAAACAEQMHAAAAAwAAgAAAAAAAgBMHng=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	5	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAV0VfAAAAAwAAgAAAAAAAgEvEMwAAAAMAAIAAAAAAAIBFhUYAAAADAACAAAAAAACAPMTiAAAAAwAAgAAAAAAAgDJG1g=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAa4XcAAAAAwAAgAAAAAAAgGLC1QAAAAMAAIAAAAAAAIBXiZIAAAADAACAAAAAAACAVEhmAAAAAwAAgAAAAAAAgEUGJw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDzMM5AAAAAwAAgAAAAAAAg7FBkAAAAAMAAIAAAAAAAIOAh7cAAAADAACAAAAAAACDasMgAAAAAwAAgAAAAAAAgyyGWQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACD0kcIAAAAAwAAgAAAAAAAg7RGpAAAAAMAAIAAAAAAAIOEiH8AAAADAACAAAAAAACDZAMgAAAAAwAAgAAAAAAAgzlEMw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABcLuAAAAAwAAgAAAAAAAQAYD6AAAAAMAAIAAAAAAAEAFxOIAAAADAACAAAAAAABABIXcAAAAAwAAgAAAAAAAQAUG1g=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAEYNrAAAAAwAAgAAAAAAAgBPCcQAAAAMAAIAAAAAAAIARRcMAAAADAACAAAAAAACADkZyAAAAAwAAgAAAAAAAgBEFkQ=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	6	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAVUGpAAAAAwAAgAAAAAAAgEpJkgAAAAMAAIAAAAAAAIBNQg0AAAADAACAAAAAAACAPolgAAAAAoAAQAAAAAAAgDQ	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAZETJAAAAAwAAgAAAAAAAgGCGvQAAAAMAAIAAAAAAAIBXB+kAAAADAACAAAAAAACAU0kVAAAAAwAAgAAAAAAAgEoDhA=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACD3MmrAAAAAwAAgAAAAAAAg8HBwgAAAAMAAIAAAAAAAIOWgwcAAAADAACAAAAAAACDdwLuAAAAAwAAgAAAAAAAg0EBqQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACD4UDhAAAAAwAAgAAAAAAAg77IAgAAAAMAAIAAAAAAAIOlAwcAAAADAACAAAAAAACDc8QaAAAAAwAAgAAAAAAAg0zA4Q=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABkPoAAAAAwAAgAAAAAAAQAXA+gAAAAMAAIAAAAAAAEAGQu4AAAADAACAAAAAAABABcH0AAAAAwAAgAAAAAAAQASIyg=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAE4ETAAAAAwAAgAAAAAAAgBCDOQAAAAMAAIAAAAAAAIATR2wAAAADAACAAAAAAACADkSXAAAAAwAAgAAAAAAAgA9EAQ=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	7	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAWIK8AAAAAwAAgAAAAAAAgE2BEwAAAAMAAIAAAAAAAIBEwZAAAAADAACAAAAAAACAOoQzAAAAAwAAgAAAAAAAgDYIfw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAZoZyAAAAAwAAgAAAAAAAgGTA+gAAAAMAAIAAAAAAAIBbgzkAAAADAACAAAAAAACAR4BLAAAAAwAAgAAAAAAAgEXBqQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACD6kdTAAAAAwAAgAAAAAAAg8LFLQAAAAMAAIAAAAAAAIOWwGQAAAADAACAAAAAAACDb8jjAAAAAwAAgAAAAAAAg1cA+g=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACD+oVGAAAAAwAAgAAAAAAAg80CvAAAAAMAAIAAAAAAAIOwxcMAAAADAACAAAAAAACDhMD6AAAAAwAAgAAAAAAAg1vDBw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAABABgAAAAMAAIAAAAAAAEAEgPoAAAADAACAAAAAAABABgD6AAAAAwAAgAAAAAAAQAYG1gAAAAMAAIAAAAAAAEAFx9A	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAEUeFAAAAAwAAgAAAAAAAgA1BRQAAAAMAAIAAAAAAAIAOBnIAAAADAACAAAAAAACADIPPAAAAAwAAgAAAAAAAgA7DUg=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	8	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAV0DhAAAAAwAAgAAAAAAAgEmAlgAAAAMAAIAAAAAAAIBGxaoAAAADAACAAAAAAACAQQmSAAAAAwAAgAAAAAAAgDnDOQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAakWRAAAAAwAAgAAAAAAAgGJDzwAAAAMAAIAAAAAAAIBZxqQAAAADAACAAAAAAACAT8RMAAAAAwAAgAAAAAAAgERI/A=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACD6sTiAAAAAwAAgAAAAAAAg9LFkQAAAAMAAIAAAAAAAIOtgZAAAAADAACAAAAAAACDgkR+AAAAAwAAgAAAAAAAg2QDBw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACECMfpAAAAAwAAgAAAAAAAg9WImAAAAAMAAIAAAAAAAIOyhzoAAAADAACAAAAAAACDj4LuAAAAAwAAgAAAAAAAg3IASw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABQjKAAAAAwAAgAAAAAAAQATA+gAAAAMAAIAAAAAAAEAFRtYAAAADAACAAAAAAABABQLuAAAAAwAAgAAAAAAAQAWG1g=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACADoX1AAAAAwAAgAAAAAAAgAzBEwAAAAMAAIAAAAAAAIATAV4AAAADAACAAAAAAACADUH0AAAAAwAAgAAAAAAAgBNB9A=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	9	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAWgeFAAAAAwAAgAAAAAAAgEuImAAAAAMAAIAAAAAAAIBGQg0AAAADAACAAAAAAACAQklHAAAAAwAAgAAAAAAAgDrJkg=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAZUAyAAAAAwAAgAAAAAAAgGRFwwAAAAMAAIAAAAAAAIBYB4UAAAADAACAAAAAAACASsT7AAAAAwAAgAAAAAAAgERIAg=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACD9IixAAAAAwAAgAAAAAAAg9iAGQAAAAMAAIAAAAAAAIOtRAEAAAADAACAAAAAAACDmwETAAAAAwAAgAAAAAAAg3AAMg=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACEEwHCAAAAAwAAgAAAAAAAg94C1QAAAAMAAIAAAAAAAIPFCS4AAAADAACAAAAAAACDooQzAAAAAwAAgAAAAAAAg3PBqQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABUPoAAAAAwAAgAAAAAAAQAUF3AAAAAMAAIAAAAAAAEAFQPoAAAADAACAAAAAAABABILuAAAAAwAAgAAAAAAAQAYIyg=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAD8F3AAAAAwAAgAAAAAAAgAyGDgAAAAMAAIAAAAAAAIASR1MAAAADAACAAAAAAACAEsXDAAAAAwAAgAAAAAAAgA6AZA=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	10	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAUcSXAAAAAwAAgAAAAAAAgFMIygAAAAMAAIAAAAAAAIBFxlkAAAADAACAAAAAAACAQMRlAAAAAwAAgAAAAAAAgDtFFA=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAYggCAAAAAwAAgAAAAAAAgGdH6QAAAAMAAIAAAAAAAIBVQfQAAAADAACAAAAAAACATESwAAAAAwAAgAAAAAAAgEWCow=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACEDsHCAAAAAwAAgAAAAAAAg+MIygAAAAMAAIAAAAAAAIO3hGUAAAADAACAAAAAAACDnsKjAAAAAwAAgAAAAAAAg2+FkQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACEHQEsAAAAAwAAgAAAAAAAg+7GiwAAAAMAAIAAAAAAAIPTBAEAAAADAACAAAAAAACDsQQaAAAAAwAAgAAAAAAAg32IsQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABcXcAAAAAwAAgAAAAAAAQAYA+gAAAAMAAIAAAAAAAEAEg+gAAAACgABAAAAAAABABIAAAAMAAIAAAAAAAEAFgfQ	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACADURlAAAAAwAAgAAAAAAAgBPGcgAAAAMAAIAAAAAAAIANSBsAAAADAACAAAAAAACAEEe3AAAAAwAAgAAAAAAAgA4Jkg=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	11	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAVch/AAAAAwAAgAAAAAAAgFFDzwAAAAMAAIAAAAAAAIBMyH8AAAADAACAAAAAAACAP8V4AAAAAwAAgAAAAAAAgDkI4w=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAbYfQAAAAAwAAgAAAAAAAgF6H6QAAAAMAAIAAAAAAAIBexqQAAAADAACAAAAAAACAUAeeAAAAAwAAgAAAAAAAgENFeA=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDkIR+AAAAAwAAgAAAAAAAg2tITQAAAAMAAIAAAAAAAINWhDMAAAADAACAAAAAAACDIAfQAAAAAwAAgAAAAAAAgwSDnQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDrgOdAAAAAwAAgAAAAAAAg33F3AAAAAMAAIAAAAAAAINZCS4AAAADAACAAAAAAACDPUDIAAAAAwAAgAAAAAAAgxvGQA=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABIbWAAAAAwAAgAAAAAAAQAVA+gAAAAMAAIAAAAAAAEAFR9AAAAADAACAAAAAAABABYPoAAAAAwAAgAAAAAAAQAZC7g=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAEITJAAAAAwAAgAAAAAAAgBKGJwAAAAMAAIAAAAAAAIAMhosAAAADAACAAAAAAACAE0bWAAAAAwAAgAAAAAAAgA0GQA=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	12	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAWMRMAAAAAwAAgAAAAAAAgEiEMwAAAAMAAIAAAAAAAIBLQUUAAAADAACAAAAAAACAREBLAAAAAwAAgAAAAAAAgDkHbA=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAawYOAAAAAwAAgAAAAAAAgGJElwAAAAMAAIAAAAAAAIBSROIAAAADAACAAAAAAACAUoZAAAAAAwAAgAAAAAAAgEwF3A=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDpMjKAAAAAwAAgAAAAAAAg37JeQAAAAMAAIAAAAAAAINixzoAAAADAACAAAAAAACDP4hmAAAAAwAAgAAAAAAAgxbAZA=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDwQO2AAAAAwAAgAAAAAAAg49FFAAAAAMAAIAAAAAAAINxA4QAAAADAACAAAAAAACDQgbWAAAAAwAAgAAAAAAAgxQDOQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABYfQAAAAAwAAgAAAAAAAQAZD6AAAAAMAAIAAAAAAAEAEyMoAAAADAACAAAAAAABABcjKAAAAAwAAgAAAAAAAQAXIyg=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAEkOEAAAAAwAAgAAAAAAAgA8F3AAAAAMAAIAAAAAAAIAOiAIAAAADAACAAAAAAACADcNSAAAAAwAAgAAAAAAAgBIG7w=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	13	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAWEbWAAAAAwAAgAAAAAAAgFBE+wAAAAMAAIAAAAAAAIBHhUYAAAADAACAAAAAAACAQAXcAAAAAwAAgAAAAAAAgDOBwg=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAZgg0AAAAAwAAgAAAAAAAgGcDIAAAAAMAAIAAAAAAAIBTB9AAAAADAACAAAAAAACASQakAAAAAwAAgAAAAAAAgEMDnQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDuwAZAAAAAwAAgAAAAAAAg5IIAgAAAAMAAIAAAAAAAIN2RZEAAAADAACAAAAAAACDS8FFAAAAAwAAgAAAAAAAgxyCig=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDvoMHAAAAAwAAgAAAAAAAg5JFLQAAAAMAAIAAAAAAAIN0wdsAAAADAACAAAAAAACDRgBkAAAAAwAAgAAAAAAAgyZEZQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABkPoAAAAAwAAgAAAAAAAQAWC7gAAAAMAAIAAAAAAAEAGQ+gAAAADAACAAAAAAABABUTiAAAAAwAAgAAAAAAAQAYC7g=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAD0JYAAAAAwAAgAAAAAAAgA5FLQAAAAMAAIAAAAAAAIATgUUAAAADAACAAAAAAACADgETAAAAAwAAgAAAAAAAgA8GWQ=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	14	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAXAJYAAAAAwAAgAAAAAAAgExArwAAAAMAAIAAAAAAAIBJx7cAAAADAACAAAAAAACAO4B9AAAAAwAAgAAAAAAAgD5DUg=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAYgQBAAAAAwAAgAAAAAAAgGGCvAAAAAMAAIAAAAAAAIBexS0AAAADAACAAAAAAACASIbWAAAAAwAAgAAAAAAAgD9ASw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDy8PoAAAAAwAAgAAAAAAAg5/A4QAAAAMAAIAAAAAAAIN9xOIAAAADAACAAAAAAACDVIH0AAAAAwAAgAAAAAAAgyRB9A=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACD2UKjAAAAAwAAgAAAAAAAg60FLQAAAAMAAIAAAAAAAIOPBdwAAAADAACAAAAAAACDYEFFAAAAAwAAgAAAAAAAg0KDtg=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABkPoAAAAAwAAgAAAAAAAQAYB9AAAAAMAAIAAAAAAAEAFhtYAAAADAACAAAAAAABABMbWAAAAAoAAQAAAAAAAQAU	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAEYlgAAAAAwAAgAAAAAAAgA/FwwAAAAMAAIAAAAAAAIAPQg0AAAADAACAAAAAAACAE0VGAAAAAwAAgAAAAAAAgA1H6Q=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	15	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAVAQBAAAAAwAAgAAAAAAAgFOCJgAAAAMAAIAAAAAAAIBHx1MAAAADAACAAAAAAACAPEVfAAAAAwAAgAAAAAAAgDbHtw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAbwgCAAAAAwAAgAAAAAAAgF7I4wAAAAMAAIAAAAAAAIBRR4UAAAADAACAAAAAAACASwEsAAAAAwAAgAAAAAAAgEoDOQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDygmSAAAAAwAAgAAAAAAAg6/B2wAAAAMAAIAAAAAAAIOHx9AAAAADAACAAAAAAACDWgQBAAAAAwAAgAAAAAAAgzzCJg=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACD2QUtAAAAAwAAgAAAAAAAg79E+wAAAAMAAIAAAAAAAIOOhkAAAAADAACAAAAAAACDdciYAAAAAwAAgAAAAAAAgzpF3A=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABcH0AAAAAwAAgAAAAAAAQAXF3AAAAAMAAIAAAAAAAEAEyMoAAAADAACAAAAAAABABUTiAAAAAwAAgAAAAAAAQAWE4g=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAEsXcAAAAAwAAgAAAAAAAgA3DUgAAAAMAAIAAAAAAAIATBicAAAADAACAAAAAAACADYV4AAAAAwAAgAAAAAAAgA7CJg=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	16	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAUAhmAAAAAwAAgAAAAAAAgE/GWQAAAAMAAIAAAAAAAIBBAakAAAADAACAAAAAAACAPABLAAAAAwAAgAAAAAAAgDSArw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAZ4lHAAAAAwAAgAAAAAAAgGbBwgAAAAMAAIAAAAAAAIBdiAIAAAADAACAAAAAAACASglgAAAAAwAAgAAAAAAAgEUE+w=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACD4kjjAAAAAwAAgAAAAAAAg8EBkAAAAAMAAIAAAAAAAIOcw50AAAADAACAAAAAAACDc8DIAAAAAwAAgAAAAAAAgz8DnQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACD34j8AAAAAwAAgAAAAAAAg8wGcgAAAAMAAIAAAAAAAIOQx9AAAAADAACAAAAAAACDbcKjAAAAAwAAgAAAAAAAg0gElw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABYjKAAAAAwAAgAAAAAAAQAVF3AAAAAMAAIAAAAAAAEAGSMoAAAADAACAAAAAAABABkLuAAAAAoAAQAAAAAAAQAT	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACADoMHAAAAAwAAgAAAAAAAgA8CcQAAAAMAAIAAAAAAAIAPSMoAAAADAACAAAAAAACAEoF3AAAAAwAAgAAAAAAAgA3Htw=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	17	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAW8QaAAAAAwAAgAAAAAAAgFKBEwAAAAMAAIAAAAAAAIBHSMoAAAADAACAAAAAAACARQK8AAAAAwAAgAAAAAAAgDSBkA=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAY0VGAAAAAwAAgAAAAAAAgGMB9AAAAAMAAIAAAAAAAIBSQzkAAAADAACAAAAAAACAVUXDAAAAAwAAgAAAAAAAgEFEsA=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACD7AO2AAAAAwAAgAAAAAAAg7pEyQAAAAMAAIAAAAAAAIOTgRMAAAADAACAAAAAAACDa8ETAAAAAwAAgAAAAAAAg0bGJw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACD9EaLAAAAAwAAgAAAAAAAg9hHOgAAAAMAAIAAAAAAAIOiwJYAAAADAACAAAAAAACDhoT7AAAAAwAAgAAAAAAAg1sGiw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABkLuAAAAAoAAQAAAAAAAQAXAAAADAACAAAAAAABABgD6AAAAAwAAgAAAAAAAQAYG1gAAAAMAAIAAAAAAAEAFxtY	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAEURlAAAAAwAAgAAAAAAAgBNINAAAAAMAAIAAAAAAAIANBS0AAAADAACAAAAAAACADkTiAAAAAwAAgAAAAAAAgBGASw=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	18	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAVEWRAAAAAwAAgAAAAAAAgE1E+wAAAAMAAIAAAAAAAIBCREwAAAADAACAAAAAAACARMchAAAAAwAAgAAAAAAAgDtGDg=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAacDIAAAAAwAAgAAAAAAAgFtGiwAAAAMAAIAAAAAAAIBdwnEAAAADAACAAAAAAACAUoe3AAAAAwAAgAAAAAAAgEADOQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACD/0SwAAAAAwAAgAAAAAAAg9lB9AAAAAMAAIAAAAAAAIOxRV8AAAADAACAAAAAAACDg0D6AAAAAwAAgAAAAAAAg13Jkg=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACEA0QaAAAAAwAAgAAAAAAAg9ECPwAAAAMAAIAAAAAAAIOxwJYAAAACgABAAAAAAACDjQAAAAMAAIAAAAAAAIN1Ros	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABMbWAAAAAwAAgAAAAAAAQAWH0AAAAAMAAIAAAAAAAEAFROIAAAADAACAAAAAAABABYD6AAAAAwAAgAAAAAAAQAYD6A=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAE4D6AAAAAwAAgAAAAAAAgBIIZgAAAAMAAIAAAAAAAIARgH0AAAADAACAAAAAAACADUcIAAAAAwAAgAAAAAAAgBHGiw=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	19	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAXAImAAAAAwAAgAAAAAAAgFPFeAAAAAMAAIAAAAAAAIBCSH8AAAADAACAAAAAAACAOcBLAAAAAwAAgAAAAAAAgD3HhQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAb8AAAAMAAIAAAAAAAIBmBqQAAAADAACAAAAAAACAWwJYAAAAAwAAgAAAAAAAgFKEMwAAAAMAAIAAAAAAAIBEyAI	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACEDQkuAAAAAwAAgAAAAAAAg9oHOgAAAAMAAIAAAAAAAIOqyAIAAAADAACAAAAAAACDj8ZZAAAAAwAAgAAAAAAAg2QFLQ=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACEAkOdAAAAAwAAgAAAAAAAg9+IZgAAAAMAAIAAAAAAAIPMgqMAAAADAACAAAAAAACDmAbvAAAAAwAAgAAAAAAAg25Alg=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABIbWAAAAAwAAgAAAAAAAQAYG1gAAAAMAAIAAAAAAAEAFQPoAAAADAACAAAAAAABABIbWAAAAAwAAgAAAAAAAQASF3A=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACADUbWAAAAAwAAgAAAAAAAgBFBEwAAAAMAAIAAAAAAAIAPRwgAAAADAACAAAAAAACADkixAAAAAwAAgAAAAAAAgA0ImA=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	20	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAWgBkAAAAAwAAgAAAAAAAgFDEMwAAAAMAAIAAAAAAAIBIB9AAAAADAACAAAAAAACAP8I/AAAAAwAAgAAAAAAAgDYJkg=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAbQLVAAAAAwAAgAAAAAAAgFrF9QAAAAMAAIAAAAAAAIBZhu8AAAADAACAAAAAAACAS4akAAAAAwAAgAAAAAAAgEyHCA=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACEB4bWAAAAAwAAgAAAAAAAg+XC7gAAAAMAAIAAAAAAAIO7QzkAAAADAACAAAAAAACDp0MHAAAAAwAAgAAAAAAAg27BkA=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACEHsaLAAAAAwAAgAAAAAAAg+uGpAAAAAMAAIAAAAAAAIPPhJcAAAADAACAAAAAAACDncV4AAAAAwAAgAAAAAAAg32FFA=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABcPoAAAAAwAAgAAAAAAAQAUB9AAAAAMAAIAAAAAAAEAGBtYAAAADAACAAAAAAABABMjKAAAAAoAAQAAAAAAAQAV	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACADwGQAAAAAwAAgAAAAAAAgAyGpAAAAAMAAIAAAAAAAIARBGUAAAADAACAAAAAAACAEYgCAAAAAwAAgAAAAAAAgBCBqQ=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	21	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAUIZAAAAAAwAAgAAAAAAAgE1INAAAAAMAAIAAAAAAAIBBCE0AAAADAACAAAAAAACAOcPoAAAAAwAAgAAAAAAAgDxCig=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAZgOEAAAAAwAAgAAAAAAAgGGDnQAAAAMAAIAAAAAAAIBXB1MAAAADAACAAAAAAACAVAVfAAAAAwAAgAAAAAAAgD8Cig=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDmYiYAAAAAwAAgAAAAAAAg3XElwAAAAMAAIAAAAAAAINUx2wAAAADAACAAAAAAACDN4K8AAAAAwAAgAAAAAAAgwLASw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDqEh/AAAAAwAAgAAAAAAAg4fGvQAAAAMAAIAAAAAAAINmxdwAAAADAACAAAAAAACDNUImAAAAAwAAgAAAAAAAgw+AyA=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABcfQAAAAAwAAgAAAAAAAQATA+gAAAAMAAIAAAAAAAEAEgu4AAAACgABAAAAAAABABcAAAAMAAIAAAAAAAEAFyMo	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAEoQzAAAAAwAAgAAAAAAAgA6ImAAAAAMAAIAAAAAAAIAPwyAAAAADAACAAAAAAACAEQM5AAAAAwAAgAAAAAAAgBPIfw=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	22	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAWkYOAAAAAwAAgAAAAAAAgEvHCAAAAAMAAIAAAAAAAIBDCasAAAADAACAAAAAAACAQAM5AAAAAwAAgAAAAAAAgDUGDg=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAbUeeAAAAAwAAgAAAAAAAgFpCPwAAAAKAAEAAAAAAAIBcAAAAAwAAgAAAAAAAgE7CPwAAAAMAAIAAAAAAAIBKhdw	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDtAJxAAAAAwAAgAAAAAAAg4QHCAAAAAMAAIAAAAAAAINXwEsAAAADAACAAAAAAACDOUYnAAAAAwAAgAAAAAAAgxLA4Q=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDwUj8AAAAAwAAgAAAAAAAg5CBEwAAAAMAAIAAAAAAAINnRosAAAADAACAAAAAAACDRQXcAAAAAwAAgAAAAAAAgyQFww=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABQD6AAAAAwAAgAAAAAAAQAXIygAAAAMAAIAAAAAAAEAEyMoAAAADAACAAAAAAABABgD6AAAAAwAAgAAAAAAAQAZIyg=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACADkEsAAAAAwAAgAAAAAAAgBAIGwAAAAMAAIAAAAAAAIANBaoAAAADAACAAAAAAACAE4mrAAAAAwAAgAAAAAAAgA7ETA=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	23	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAWYfQAAAAAwAAgAAAAAAAgFKETAAAAAMAAIAAAAAAAIBKRZEAAAADAACAAAAAAACAQcI/AAAAAwAAgAAAAAAAgDtDzw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAboSwAAAAAwAAgAAAAAAAgFyC7gAAAAMAAIAAAAAAAIBYxMkAAAADAACAAAAAAACATED6AAAAAwAAgAAAAAAAgEpBLA=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDtkFeAAAAAwAAgAAAAAAAg4XHngAAAAMAAIAAAAAAAINmh9AAAAADAACAAAAAAACDQMKKAAAAAwAAgAAAAAAAgxTE+w=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDyIh/AAAAAwAAgAAAAAAAg5JGiwAAAAMAAIAAAAAAAINtwV4AAAADAACAAAAAAACDVga9AAAAAwAAgAAAAAAAgySINA=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABYPoAAAAAwAAgAAAAAAAQASB9AAAAAMAAIAAAAAAAEAEx9AAAAADAACAAAAAAABABMjKAAAAAwAAgAAAAAAAQAZF3A=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAEMCWAAAAAwAAgAAAAAAAgBMG1gAAAAMAAIAAAAAAAIAPREwAAAADAACAAAAAAACAD4MgAAAAAwAAgAAAAAAAgA6HbA=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	24	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAVkB9AAAAAwAAgAAAAAAAgE8AyAAAAAMAAIAAAAAAAIBBw88AAAADAACAAAAAAACAPgCvAAAAAwAAgAAAAAAAgD3G1g=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAZ8hmAAAAAwAAgAAAAAAAgF4FwwAAAAMAAIAAAAAAAIBUgrwAAAADAACAAAAAAACAUENSAAAAAwAAgAAAAAAAgEyGJw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDxwJYAAAAAwAAgAAAAAAAg5JGQAAAAAMAAIAAAAAAAIN9QH0AAAADAACAAAAAAACDUgH0AAAAAwAAgAAAAAAAgyBDBw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACDyUaLAAAAAwAAgAAAAAAAg7XF3AAAAAMAAIAAAAAAAIOPhu8AAAADAACAAAAAAACDaYa9AAAAAwAAgAAAAAAAgz2HOg=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABUD6AAAAAwAAgAAAAAAAQAYH0AAAAAMAAIAAAAAAAEAFw+gAAAADAACAAAAAAABABkfQAAAAAwAAgAAAAAAAQAWD6A=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAEwM5AAAAAwAAgAAAAAAAgA7AlgAAAAMAAIAAAAAAAIAPSMoAAAADAACAAAAAAACAEoCWAAAAAwAAgAAAAAAAgBDEMw=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
5	25	2025-12-20 00:00:00+00	2025-12-24 00:00:00+00	BAAAAulVpM/gAP///+viKKAAAAAABQAAAAMAAAAAAAAB7gAF00w4WsAAAAXTdHQJf/8AAAAAAAAAAA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAXAZZAAAAAwAAgAAAAAAAgE9IZgAAAAMAAIAAAAAAAIBGgtUAAAADAACAAAAAAACAPUNSAAAAAwAAgAAAAAAAgD5CJg=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACAcAdTAAAAAwAAgAAAAAAAgGaFwwAAAAMAAIAAAAAAAIBQwqMAAAADAACAAAAAAACATUHbAAAAAwAAgAAAAAAAgEuCig=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAUAAAAAKAAEAAAAAAAIBIgAAAAoAAQAAAAAAAgEEAAAACgABAAAAAAACAOYAAAAKAAEAAAAAAAIAyA==	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAACgABAAAAAAACAYYAAAAKAAEAAAAAAAIBYwAAAAoAAQAAAAAAAgFAAAAACgABAAAAAAACAR0AAAAKAAEAAAAAAAIA+g==	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAAa0nSAA	AgBwZ19jYXRhbG9nAHRpbWUAAAAABQAAAAEAAAAAAAAAAQAAAAAAAAAAAAEAAAABAAAACAAAAA8WYYgA	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACD1IETAAAAAwAAgAAAAAAAg7DHbAAAAAMAAIAAAAAAAIOPSXkAAAADAACAAAAAAACDX0INAAAAAwAAgAAAAAAAg0LI4w=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACD5sHCAAAAAwAAgAAAAAAAg61FwwAAAAMAAIAAAAAAAIOZRcMAAAADAACAAAAAAACDacNSAAAAAwAAgAAAAAAAgz0EMw=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAABABgfQAAAAAwAAgAAAAAAAQAXA+gAAAAMAAIAAAAAAAEAEhdwAAAADAACAAAAAAABABYPoAAAAAwAAgAAAAAAAQAVE4g=	AQBwZ19jYXRhbG9nAG51bWVyaWMAAAEAAAAFAAAADAACAAAAAAACADMTiAAAAAwAAgAAAAAAAgA4EfgAAAAMAAIAAAAAAAIARgj8AAAADAACAAAAAAACAD4gCAAAAAwAAgAAAAAAAgA5GJw=	Bg==	Bg==	BAAAAAAAAAAAAQAAAAAAAAAAAAAABQAAAAEAAAAAAAAAAgAAAAAAAAAG	Bg==	Bg==	Bg==	Bg==	Bg==	Bg==	f	f	BQAAAAAFAAAAAQAAAAAAAAABAAAAAAAAAAA=	\N
\.


--
-- Data for Name: abattoirs; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.abattoirs (id, nom, adresse, ville, code_postal, numero_agrement, contact_telephone, created_at) FROM stdin;
1	Abattoir des Landes	5 Zone Industrielle	Mont-de-Marsan	40000	FR-40-001-001	+33558123456	2025-12-26 10:36:31.334886+00
2	Abattoir des Landes	15 Zone Industrielle	Mont-de-Marsan	40000	FR-40-123-001	0558123456	2025-12-26 10:57:46.379451+00
3	Abattoir du Gers	20 Route de Toulouse	Auch	32000	FR-32-456-002	0562456789	2025-12-26 10:57:46.379451+00
\.


--
-- Data for Name: alertes; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.alertes ("time", canard_id, niveau, type_alerte, message, valeur_mesuree, valeur_seuil, sms_envoye, acquittee, acquittee_par, acquittee_le) FROM stdin;
\.


--
-- Data for Name: alertes_euralis; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.alertes_euralis ("time", id, lot_id, gaveur_id, site_code, type_alerte, criticite, titre, description, valeur_observee, valeur_attendue, ecart_pct, acquittee, acquittee_par, acquittee_le, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: anomalies_detectees; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.anomalies_detectees (id, niveau, lot_id, gaveur_id, site_code, score_anomalie, is_anomaly, raisons, metriques_anormales, modele_version, detectee_le, traitee, traitee_le, created_at) FROM stdin;
\.


--
-- Data for Name: blockchain; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.blockchain (index, "timestamp", type_evenement, canard_id, gaveur_id, abattoir_id, donnees, hash_precedent, hash_actuel, signature_numerique) FROM stdin;
\.


--
-- Data for Name: bug_comments; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.bug_comments (id, bug_report_id, comment, author, author_email, is_internal, attachments, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: bug_metrics; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.bug_metrics (id, date, total_bugs, open_bugs, in_progress_bugs, resolved_bugs, closed_bugs, critical_bugs, high_severity_bugs, medium_severity_bugs, low_severity_bugs, avg_resolution_time_hours, avg_response_time_hours, new_bugs_today, resolved_today, created_at) FROM stdin;
\.


--
-- Data for Name: bug_reports; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.bug_reports (id, title, description, severity, priority, category, status, device_id, firmware_version, sample_id, reported_by, reported_by_email, assigned_to, assigned_at, resolution, resolved_at, resolved_by, attachments, error_logs, reproduction_steps, tags, related_issues, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: canards; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.canards (id, numero_identification, gaveur_id, genetique, date_naissance, origine_elevage, numero_lot_canard, poids_initial, statut, created_at, updated_at, lot_id) FROM stdin;
1	CAN-1-001	1	barbarie	2025-09-27 10:57:46.396435+00	Élevage Dupont	LOT-1-2025	3050.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
2	CAN-1-002	1	pekin	2025-09-27 10:57:46.396435+00	Élevage Dupont	LOT-1-2025	3100.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
3	CAN-1-003	1	mixte	2025-09-27 10:57:46.396435+00	Élevage Dupont	LOT-1-2025	3150.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
4	CAN-1-004	1	mulard	2025-09-27 10:57:46.396435+00	Élevage Dupont	LOT-1-2025	3200.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
5	CAN-1-005	1	barbarie	2025-09-27 10:57:46.396435+00	Élevage Dupont	LOT-1-2025	3250.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
6	CAN-1-006	1	pekin	2025-09-27 10:57:46.396435+00	Élevage Dupont	LOT-1-2025	3300.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
7	CAN-1-007	1	mixte	2025-09-27 10:57:46.396435+00	Élevage Dupont	LOT-1-2025	3350.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
8	CAN-1-008	1	mulard	2025-09-27 10:57:46.396435+00	Élevage Dupont	LOT-1-2025	3400.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
9	CAN-1-009	1	barbarie	2025-09-27 10:57:46.396435+00	Élevage Dupont	LOT-1-2025	3450.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
10	CAN-1-010	1	pekin	2025-09-27 10:57:46.396435+00	Élevage Dupont	LOT-1-2025	3500.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
11	CAN-3-001	3	barbarie	2025-09-27 10:57:46.396435+00	Élevage Martin	LOT-3-2025	3050.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
12	CAN-3-002	3	pekin	2025-09-27 10:57:46.396435+00	Élevage Martin	LOT-3-2025	3100.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
13	CAN-3-003	3	mixte	2025-09-27 10:57:46.396435+00	Élevage Martin	LOT-3-2025	3150.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
14	CAN-3-004	3	mulard	2025-09-27 10:57:46.396435+00	Élevage Martin	LOT-3-2025	3200.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
15	CAN-3-005	3	barbarie	2025-09-27 10:57:46.396435+00	Élevage Martin	LOT-3-2025	3250.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
16	CAN-3-006	3	pekin	2025-09-27 10:57:46.396435+00	Élevage Martin	LOT-3-2025	3300.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
17	CAN-3-007	3	mixte	2025-09-27 10:57:46.396435+00	Élevage Martin	LOT-3-2025	3350.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
18	CAN-3-008	3	mulard	2025-09-27 10:57:46.396435+00	Élevage Martin	LOT-3-2025	3400.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
19	CAN-3-009	3	barbarie	2025-09-27 10:57:46.396435+00	Élevage Martin	LOT-3-2025	3450.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
20	CAN-3-010	3	pekin	2025-09-27 10:57:46.396435+00	Élevage Martin	LOT-3-2025	3500.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
21	CAN-4-001	4	barbarie	2025-09-27 10:57:46.396435+00	Élevage Bernard	LOT-4-2025	3050.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
22	CAN-4-002	4	pekin	2025-09-27 10:57:46.396435+00	Élevage Bernard	LOT-4-2025	3100.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
23	CAN-4-003	4	mixte	2025-09-27 10:57:46.396435+00	Élevage Bernard	LOT-4-2025	3150.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
24	CAN-4-004	4	mulard	2025-09-27 10:57:46.396435+00	Élevage Bernard	LOT-4-2025	3200.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
25	CAN-4-005	4	barbarie	2025-09-27 10:57:46.396435+00	Élevage Bernard	LOT-4-2025	3250.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
26	CAN-4-006	4	pekin	2025-09-27 10:57:46.396435+00	Élevage Bernard	LOT-4-2025	3300.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
27	CAN-4-007	4	mixte	2025-09-27 10:57:46.396435+00	Élevage Bernard	LOT-4-2025	3350.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
28	CAN-4-008	4	mulard	2025-09-27 10:57:46.396435+00	Élevage Bernard	LOT-4-2025	3400.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
29	CAN-4-009	4	barbarie	2025-09-27 10:57:46.396435+00	Élevage Bernard	LOT-4-2025	3450.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
30	CAN-4-010	4	pekin	2025-09-27 10:57:46.396435+00	Élevage Bernard	LOT-4-2025	3500.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
31	CAN-5-001	5	barbarie	2025-09-27 10:57:46.396435+00	Élevage Dubois	LOT-5-2025	3050.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
32	CAN-5-002	5	pekin	2025-09-27 10:57:46.396435+00	Élevage Dubois	LOT-5-2025	3100.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
33	CAN-5-003	5	mixte	2025-09-27 10:57:46.396435+00	Élevage Dubois	LOT-5-2025	3150.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
34	CAN-5-004	5	mulard	2025-09-27 10:57:46.396435+00	Élevage Dubois	LOT-5-2025	3200.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
35	CAN-5-005	5	barbarie	2025-09-27 10:57:46.396435+00	Élevage Dubois	LOT-5-2025	3250.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
36	CAN-5-006	5	pekin	2025-09-27 10:57:46.396435+00	Élevage Dubois	LOT-5-2025	3300.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
37	CAN-5-007	5	mixte	2025-09-27 10:57:46.396435+00	Élevage Dubois	LOT-5-2025	3350.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
38	CAN-5-008	5	mulard	2025-09-27 10:57:46.396435+00	Élevage Dubois	LOT-5-2025	3400.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
39	CAN-5-009	5	barbarie	2025-09-27 10:57:46.396435+00	Élevage Dubois	LOT-5-2025	3450.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
40	CAN-5-010	5	pekin	2025-09-27 10:57:46.396435+00	Élevage Dubois	LOT-5-2025	3500.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
41	CAN-6-001	6	barbarie	2025-09-27 10:57:46.396435+00	Élevage Leroy	LOT-6-2025	3050.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
42	CAN-6-002	6	pekin	2025-09-27 10:57:46.396435+00	Élevage Leroy	LOT-6-2025	3100.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
43	CAN-6-003	6	mixte	2025-09-27 10:57:46.396435+00	Élevage Leroy	LOT-6-2025	3150.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
44	CAN-6-004	6	mulard	2025-09-27 10:57:46.396435+00	Élevage Leroy	LOT-6-2025	3200.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
45	CAN-6-005	6	barbarie	2025-09-27 10:57:46.396435+00	Élevage Leroy	LOT-6-2025	3250.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
46	CAN-6-006	6	pekin	2025-09-27 10:57:46.396435+00	Élevage Leroy	LOT-6-2025	3300.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
47	CAN-6-007	6	mixte	2025-09-27 10:57:46.396435+00	Élevage Leroy	LOT-6-2025	3350.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
48	CAN-6-008	6	mulard	2025-09-27 10:57:46.396435+00	Élevage Leroy	LOT-6-2025	3400.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
49	CAN-6-009	6	barbarie	2025-09-27 10:57:46.396435+00	Élevage Leroy	LOT-6-2025	3450.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
50	CAN-6-010	6	pekin	2025-09-27 10:57:46.396435+00	Élevage Leroy	LOT-6-2025	3500.00	en_gavage	2025-12-26 10:57:46.396435+00	2025-12-26 10:57:46.396435+00	\N
\.


--
-- Data for Name: consumer_feedback_ml_data; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.consumer_feedback_ml_data (ml_data_id, feedback_id, lot_id, sample_id, lot_itm, lot_avg_weight, lot_mortality_rate, lot_feed_conversion, sqal_score, sqal_grade, vl53l8ch_volume_mm3, vl53l8ch_surface_uniformity, as7341_freshness_index, as7341_fat_quality_index, as7341_oxidation_index, consumer_overall_rating, consumer_texture_rating, consumer_flavor_rating, consumer_freshness_rating, consumer_would_recommend, site_code, production_date, consumption_delay_days, created_at, used_for_training, train_test_split) FROM stdin;
\.


--
-- Data for Name: consumer_feedback_ml_insights; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.consumer_feedback_ml_insights (insight_id, model_name, model_version, generated_at, period_start, period_end, site_code, correlations, feature_importance, recommendations, predicted_consumer_score_avg, prediction_accuracy, sample_size, training_metrics, is_active) FROM stdin;
\.


--
-- Data for Name: consumer_feedbacks; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.consumer_feedbacks ("time", feedback_id, product_id, overall_rating, texture_rating, flavor_rating, color_rating, aroma_rating, freshness_rating, comment, consumption_context, consumption_date, consumer_age_range, consumer_region, would_recommend, repurchase_intent, photo_urls, device_type, app_version, ip_hash, is_verified, is_moderated, is_public, moderation_notes, reward_points_granted) FROM stdin;
\.


--
-- Data for Name: consumer_products; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.consumer_products (product_id, qr_code, qr_signature, lot_id, sample_id, site_code, production_date, quality_control_date, packaging_date, best_before_date, sqal_quality_score, sqal_grade, sqal_compliance, lot_itm, lot_avg_weight, gavage_duration_days, certifications, production_method, carbon_footprint_kg, animal_welfare_score, blockchain_hash, blockchain_verified, created_at, is_active) FROM stdin;
\.


--
-- Data for Name: corrections_doses; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.corrections_doses (id, canard_id, date, dose_theorique, dose_reelle, ecart_absolu, ecart_pourcentage, correction_proposee, raison, impact_prevu, created_at) FROM stdin;
\.


--
-- Data for Name: doses_journalieres; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.doses_journalieres ("time", lot_id, jour_gavage, feed_target, feed_real, corn_variation, delta_feed, cumul_corn, created_at, code_lot, jour, moment, dose_theorique, dose_reelle, poids_moyen, nb_vivants, taux_mortalite, temperature, humidite) FROM stdin;
\.


--
-- Data for Name: formules_pysr; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.formules_pysr (id, site_code, souche, formule_sympy, formule_latex, score_r2, mae, rmse, variables_input, nb_iterations, modele_version, nb_lots_entrainement, created_at) FROM stdin;
\.


--
-- Data for Name: gavage_data; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.gavage_data ("time", canard_id, dose_matin, dose_soir, dose_theorique_matin, dose_theorique_soir, heure_gavage_matin, heure_gavage_soir, poids_matin, poids_soir, temperature_stabule, humidite_stabule, qualite_air_co2, luminosite, lot_mais_id, remarques, comportement_observe, etat_sanitaire, correction_proposee, ecart_dose_matin, ecart_dose_soir, alerte_generee, poids_actuel) FROM stdin;
\.


--
-- Data for Name: gavage_data_lots; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.gavage_data_lots ("time", lot_gavage_id, jour_gavage, repas, dose_moyenne, dose_theorique, poids_moyen_lot, nb_canards_vivants, nb_canards_morts, taux_mortalite, temperature_stabule, humidite_stabule, remarques) FROM stdin;
\.


--
-- Data for Name: gavage_lot_quotidien; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.gavage_lot_quotidien (id, lot_id, date_gavage, jour_gavage, dose_matin, dose_soir, heure_gavage_matin, heure_gavage_soir, nb_canards_peses, poids_echantillon, poids_moyen_mesure, gain_poids_jour, gain_poids_cumule, temperature_stabule, humidite_stabule, dose_theorique_matin, dose_theorique_soir, poids_theorique, ecart_dose_pourcent, ecart_poids_pourcent, suit_courbe_theorique, raison_ecart, remarques, mortalite_jour, cause_mortalite, problemes_sante, alerte_generee, niveau_alerte, recommandations_ia, prediction_activee, created_at) FROM stdin;
\.


--
-- Data for Name: gaveurs; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.gaveurs (id, nom, prenom, email, telephone, password_hash, adresse, certifications, actif, cle_publique_blockchain, created_at, updated_at) FROM stdin;
1	Dupont	Jean	jean.dupont@example.com	+33612345678	$2b$12$KIXxKj8YP.VhU7xK.VhU7xK.VhU7xK.VhU7xK.VhU7xK.VhU7xK.VhU	12 Route des Landes, 40000 Mont-de-Marsan	\N	t	\N	2025-12-26 10:36:31.331582+00	2025-12-26 10:36:31.331582+00
3	Martin	Pierre	pierre.martin@example.com	0602030405	$2b$12$test123	5 Avenue du Foie Gras, 32000 Auch	\N	t	\N	2025-12-26 10:57:46.359361+00	2025-12-26 10:57:46.359361+00
4	Bernard	Paul	paul.bernard@example.com	0603040506	$2b$12$test123	10 Chemin des Canards, 47000 Agen	\N	t	\N	2025-12-26 10:57:46.359361+00	2025-12-26 10:57:46.359361+00
5	Dubois	Marie	marie.dubois@example.com	0604050607	$2b$12$test123	3 Impasse du Gavage, 40000 Dax	\N	t	\N	2025-12-26 10:57:46.359361+00	2025-12-26 10:57:46.359361+00
6	Leroy	Sophie	sophie.leroy@example.com	0605060708	$2b$12$test123	8 Route de Landes, 32000 Condom	\N	t	\N	2025-12-26 10:57:46.359361+00	2025-12-26 10:57:46.359361+00
12	Martin	Jean	jean.martin@gaveur.fr	0612345678	hashed_password	\N	\N	t	\N	2026-01-01 11:18:44.077935+00	2026-01-01 11:18:44.077935+00
15	Martin	Jean	sim@gaveurs.fr	0123456789	$2b$12$dummy_hash_for_simulator	\N	\N	t	\N	2026-01-07 18:04:39.749538+00	2026-01-07 18:04:39.749538+00
\.


--
-- Data for Name: gaveurs_clusters; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.gaveurs_clusters (id, gaveur_id, cluster_id, cluster_label, itm_moyen, sigma_moyen, mortalite_moyenne, nb_lots_total, stabilite_score, recommandations, modele_version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: gaveurs_euralis; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.gaveurs_euralis (id, nom, prenom, nom_usage, civilite, raison_sociale, adresse1, adresse2, code_postal, commune, telephone, email, site_code, actif, created_at, updated_at) FROM stdin;
1	Jean Martin	\N	\N	\N	\N	\N	\N	\N	\N	\N	jean.martin@gaveur.fr	LL	t	2025-12-26 19:45:40.393626+00	2025-12-26 19:45:40.393626+00
2	Sophie Dubois	\N	\N	\N	\N	\N	\N	\N	\N	\N	sophie.dubois@gaveur.fr	LS	t	2025-12-26 19:45:40.393626+00	2025-12-26 19:45:40.393626+00
3	Pierre Leroy	\N	\N	\N	\N	\N	\N	\N	\N	\N	pierre.leroy@gaveur.fr	MT	t	2025-12-26 19:45:40.393626+00	2025-12-26 19:45:40.393626+00
4	Marie Petit	\N	\N	\N	\N	\N	\N	\N	\N	\N	marie.petit@gaveur.fr	LL	t	2025-12-26 19:45:40.393626+00	2025-12-26 19:45:40.393626+00
5	Luc Blanc	\N	\N	\N	\N	\N	\N	\N	\N	\N	luc.blanc@gaveur.fr	LS	t	2025-12-26 19:45:40.393626+00	2025-12-26 19:45:40.393626+00
\.


--
-- Data for Name: lot_events; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.lot_events (id, lot_id, "timestamp", event_type, data, description) FROM stdin;
\.


--
-- Data for Name: lot_mais; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.lot_mais (id, numero_lot, origine, date_reception, taux_humidite, qualite_note, created_at) FROM stdin;
1	MAIS-2024-001	Ferme Durand, Chalosse	2025-12-16 10:36:31.342017+00	14.50	9.2	2025-12-26 10:36:31.342017+00
2	MAIS-2025-001	Ferme Laborde	2025-11-26 10:57:46.386655+00	14.50	8.5	2025-12-26 10:57:46.386655+00
3	MAIS-2025-002	Coopérative Sud-Ouest	2025-12-01 10:57:46.386655+00	15.20	8.0	2025-12-26 10:57:46.386655+00
4	MAIS-2025-003	Ferme Dufour	2025-12-06 10:57:46.386655+00	13.80	9.0	2025-12-26 10:57:46.386655+00
\.


--
-- Data for Name: lots; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.lots (id, code_lot, site_origine, nombre_canards, genetique, date_debut_gavage, date_fin_gavage_prevue, date_fin_gavage_reelle, poids_moyen_initial, poids_moyen_actuel, poids_moyen_final, objectif_quantite_mais, objectif_poids_final, courbe_theorique, formule_pysr, r2_score_theorique, statut, gaveur_id, lot_mais_id, nombre_jours_gavage_ecoules, taux_mortalite, nombre_mortalite, taux_conformite, created_at, updated_at) FROM stdin;
1	LL_042	Bretagne	200	mulard	2025-12-19	2026-01-02	\N	4000.00	4995.20	\N	6300	6800	[{"jour": -355, "poids": 4048.41}, {"jour": 1, "poids": 4095.8}, {"jour": 2, "poids": 4144.22}, {"jour": 3, "poids": 4193.65}, {"jour": 4, "poids": 4244.1}, {"jour": 5, "poids": 4295.55}, {"jour": 6, "poids": 4348.01}, {"jour": 7, "poids": 4401.45}, {"jour": 8, "poids": 4455.88}, {"jour": 9, "poids": 4511.3}, {"jour": 10, "poids": 4567.69}, {"jour": 11, "poids": 4616.1}, {"jour": 12, "poids": 4664.52}, {"jour": 13, "poids": 4721.87}, {"jour": 14, "poids": 4780.2}]	0.42*dose_matin^0.8 + 0.38*dose_soir^0.75 - 0.15*temperature + 12.3	\N	en_gavage	1	\N	14	0.00	0	\N	2025-12-28 11:44:20.833094+00	2026-01-01 18:10:11.614886+00
\.


--
-- Data for Name: lots_gavage; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.lots_gavage (id, code_lot, site_code, gaveur_id, debut_lot, duree_gavage_reelle, duree_du_lot, souche, geo, saison, age_animaux, nb_meg, nb_enleve, nb_accroches, nb_morts, itm, itm_cut, sigma, sigma_cut, pctg_perte_gavage, total_corn_target, total_corn_real, qte_total_test, conso_gav_z1, code_plan_alimentation, code_plan_alimentation_compl, four_alim_elev, four_alim_gav, eleveur, prod_igp_fr, lot_gav, lot_pag, statut, created_at, updated_at, genetique, nb_canards_initial, poids_moyen_actuel, taux_mortalite, jour_actuel, pret_abattage) FROM stdin;
3474	LS2601002	LS	2	2026-01-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	termine	2026-01-03 17:30:41.617775+00	2026-01-08 09:02:54.12329+00	Barbarie	48	6733.80	2.17	11	t
122	LL2512002	LL	1	2025-12-26	\N	\N	\N	\N	\N	\N	\N	\N	201	\N	0.0747	\N	\N	\N	1.35993753	\N	1404283.85	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	termine	2025-12-26 19:46:08.350814+00	2026-01-01 17:55:11.662791+00	Mulard	44	5957.40	0.00	6	f
123	LS2512003	LS	2	2025-12-26	\N	\N	\N	\N	\N	\N	\N	\N	248	\N	0.0749	\N	\N	\N	3.15331328	\N	2084464.35	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	termine	2025-12-26 19:46:08.356832+00	2026-01-01 17:55:11.662791+00	Mulard	50	5946.40	1.92	6	f
121	LL2512001	LL	1	2025-12-26	\N	\N	\N	\N	\N	\N	\N	\N	177	\N	0.0702	\N	\N	\N	1.81464814	\N	1221655.07	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	termine	2025-12-26 19:46:08.346223+00	2026-01-01 17:55:11.662791+00	Mulard	53	7129.30	2.00	13	t
346	LL2512003	LL	4	2025-12-26	\N	\N	\N	\N	\N	\N	\N	\N	240	\N	0.0942	\N	\N	\N	1.65588882	\N	2059677.60	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	termine	2025-12-26 20:25:03.755897+00	2026-01-01 17:55:11.662791+00	Mulard	54	6206.90	0.00	12	t
426	MT2512003	MT	3	2025-12-26	\N	\N	\N	\N	\N	\N	\N	\N	199	\N	0.0632	\N	\N	\N	2.58635535	\N	1455170.48	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	termine	2025-12-26 20:39:10.959575+00	2026-01-01 17:55:11.662791+00	Mulard	52	6933.50	1.89	12	t
273	LS2512002	LS	2	2025-12-26	\N	\N	\N	\N	\N	\N	\N	\N	170	\N	0.0675	\N	\N	\N	3.34261734	\N	1430927.69	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	termine	2025-12-26 20:12:56.812883+00	2026-01-01 17:55:11.662791+00	Mulard	50	5858.00	2.13	12	t
186	MT2512001	MT	3	2025-12-26	\N	\N	\N	\N	\N	\N	\N	\N	223	\N	0.0652	\N	\N	\N	2.41928114	\N	1546592.68	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	termine	2025-12-26 19:57:49.623238+00	2026-01-01 17:55:11.662791+00	Barbarie	49	7311.10	3.64	14	t
272	LS2512001	LS	2	2025-12-26	\N	\N	\N	\N	\N	\N	\N	\N	239	\N	0.0946	\N	\N	\N	1.70190058	\N	1623341.35	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	termine	2025-12-26 20:12:56.810564+00	2026-01-02 08:57:12.920355+00	Pékin	51	5947.00	4.00	6	f
3487	LS2601001	LS	5	2026-01-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	termine	2026-01-03 17:33:42.73461+00	2026-01-08 09:03:54.209282+00	Mulard	46	6937.00	8.16	12	t
3473	LS2601003	LS	2	2026-01-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	termine	2026-01-03 17:30:41.617495+00	2026-01-08 09:04:54.243868+00	Mulard	45	7115.00	1.82	13	t
187	MT2512002	MT	3	2025-12-26	\N	\N	\N	\N	\N	\N	\N	\N	177	\N	0.1032	\N	\N	\N	1.49341139	\N	1132434.46	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	termine	2025-12-26 19:57:49.626401+00	2026-01-02 08:58:01.829735+00	Mulard	54	5984.50	1.89	11	f
3468	LL_JM_2024_01	LL	1	2025-12-27	14	\N	mulard	\N	\N	\N	\N	\N	150	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	en_cours	2026-01-01 11:19:21.354415+00	2026-01-01 11:19:21.354415+00	Grimaud	150	\N	0.00	-1	f
3469	LL_MP_2024_01	LL	4	2025-12-25	14	\N	mulard	\N	\N	\N	\N	\N	200	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	en_cours	2026-01-01 11:47:34.088247+00	2026-01-01 11:47:34.088247+00	Grimaud	200	\N	0.00	-1	f
3470	LS_SD_2024_01	LS	2	2025-12-26	14	\N	mulard	\N	\N	\N	\N	\N	180	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	en_cours	2026-01-01 11:47:34.088247+00	2026-01-01 11:47:34.088247+00	Grimaud	180	\N	0.00	-1	f
3471	MT_PL_2024_01	MT	3	2025-12-24	14	\N	mulard	\N	\N	\N	\N	\N	220	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	en_cours	2026-01-01 11:47:34.088247+00	2026-01-01 11:47:34.088247+00	Grimaud	220	\N	0.00	-1	f
3570	MT2601002	MT	3	2026-01-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	termine	2026-01-03 19:46:30.747824+00	2026-01-08 07:38:13.398675+00	Barbarie	48	6777.10	2.22	11	t
3472	LL2601001	LL	4	2026-01-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	termine	2026-01-03 17:30:41.506042+00	2026-01-08 09:09:30.347051+00	Barbarie	53	5453.40	0.00	4	f
3488	LL2601002	LL	4	2026-01-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	termine	2026-01-03 17:33:42.737669+00	2026-01-08 09:09:30.35062+00	Pékin	47	5486.00	1.82	4	f
3489	LL2601003	LL	4	2026-01-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	termine	2026-01-03 17:33:42.741317+00	2026-01-08 09:09:30.353817+00	Pékin	46	5481.60	0.00	4	f
4516	MT2601003	MT	3	2026-01-07	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	termine	2026-01-07 12:02:15.347477+00	2026-01-08 08:49:47.480408+00	Mulard	48	5681.50	6.12	11	t
3658	MT2601001	MT	3	2026-01-03	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	termine	2026-01-03 21:01:54.84477+00	2026-01-07 22:12:55.641753+00	Mulard	52	7112.50	2.17	13	t
\.


--
-- Data for Name: lots_registry; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.lots_registry (lot_id, gaveur_id, nb_canards, created_at, gavage_status, gavage_started_at, gavage_ended_at, current_day, itm_moyen, sqal_samples, sqal_grades, consumer_feedbacks, average_rating, blockchain_hash, updated_at) FROM stdin;
LOT_20260107_7207	G100	40	2026-01-07 17:32:33.823253	en_cours	2026-01-07 17:32:33.823258	\N	0	\N	{}	{}	{}	\N	\N	2026-01-07 17:32:33.823656
LOT_20260107_9961	G101	45	2026-01-07 17:32:33.836813	en_cours	2026-01-07 17:32:33.836815	\N	0	\N	{}	{}	{}	\N	\N	2026-01-07 17:32:33.836949
LOT_20260107_1121	G102	50	2026-01-07 17:32:33.839149	en_cours	2026-01-07 17:32:33.839151	\N	0	\N	{}	{}	{}	\N	\N	2026-01-07 17:32:33.839319
LOT_20260107_3193	G100	40	2026-01-07 17:35:12.652468	en_cours	2026-01-07 17:35:12.652472	\N	0	\N	{}	{}	{}	\N	\N	2026-01-07 17:35:12.652817
LOT_20260107_1864	G101	45	2026-01-07 17:35:12.664428	en_cours	2026-01-07 17:35:12.664429	\N	0	\N	{}	{}	{}	\N	\N	2026-01-07 17:35:12.664667
LOT_20260107_2292	G102	50	2026-01-07 17:35:12.666756	en_cours	2026-01-07 17:35:12.666757	\N	0	\N	{}	{}	{}	\N	\N	2026-01-07 17:35:12.666889
\.


--
-- Data for Name: ml_models; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.ml_models (id, genetique, formule_symbolique, score_r2, metadata, actif, created_at) FROM stdin;
\.


--
-- Data for Name: mortalite; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.mortalite (id, canard_id, date_deces, cause, poids_au_deces, jours_gavage_effectues, rapport_veterinaire, created_at) FROM stdin;
\.


--
-- Data for Name: planning_abattages; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.planning_abattages (id, lot_id, site_code, date_abattage_prevue, date_abattage_reelle, abattoir, creneau_horaire, nb_canards_prevu, nb_canards_reel, capacite_abattoir_jour, taux_utilisation_pct, cout_transport, distance_km, priorite, statut, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: predictions_courbes; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.predictions_courbes (id, canard_id, date_prediction, jours_gavage, poids_predits, doses_recommandees_matin, doses_recommandees_soir, confiance, formule_symbolique, created_at) FROM stdin;
\.


--
-- Data for Name: previsions_production; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.previsions_production (id, site_code, date_prevision, horizon_jours, production_prevue_kg, itm_prevu, nb_lots_prevu, production_min_kg, production_max_kg, itm_min, itm_max, modele_version, confidence, created_at) FROM stdin;
\.


--
-- Data for Name: sites_euralis; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.sites_euralis (id, code, nom, region, capacite_gavage_max, nb_gaveurs_actifs, created_at, updated_at) FROM stdin;
1	LL	Bretagne	BRETAGNE	30000	2	2025-12-26 10:33:25.688387+00	2025-12-26 10:33:25.688387+00
2	LS	Pays de Loire	PAYS DE LA LOIRE	28000	1	2025-12-26 10:33:25.688387+00	2025-12-26 10:33:25.688387+00
3	MT	Maubourguet	OCCITANIE	35000	1	2025-12-26 10:33:25.688387+00	2025-12-26 10:33:25.688387+00
\.


--
-- Data for Name: sqal_alerts; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.sqal_alerts ("time", alert_id, sample_id, device_id, lot_id, alert_type, severity, title, message, defect_details, threshold_value, actual_value, deviation_pct, acknowledged, acknowledged_by, acknowledged_at, resolution_notes, created_at) FROM stdin;
\.


--
-- Data for Name: sqal_devices; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.sqal_devices (device_id, device_name, device_type, firmware_version, site_code, status, last_seen, config_profile, notes, created_at, updated_at) FROM stdin;
ESP32-FOIEGRAS-LL-001	Capteur Bretagne 1	ESP32	v1.0.0	LL	active	\N	foiegras_premium	\N	2025-12-27 19:51:29.017798+00	2025-12-27 19:51:29.017798+00
ESP32-FOIEGRAS-LS-001	Capteur Pays de Loire 1	ESP32	v1.0.0	LS	active	\N	foiegras_premium	\N	2025-12-27 19:51:29.017798+00	2025-12-27 19:51:29.017798+00
ESP32-FOIEGRAS-MT-001	Capteur Maubourguet 1	ESP32	v1.0.0	MT	active	\N	foiegras_premium	\N	2025-12-27 19:51:29.017798+00	2025-12-27 19:51:29.017798+00
TEST	Device Test	ESP32	\N	LL	active	2026-01-06 12:00:00+00	\N	\N	2026-01-06 12:02:39.925904+00	2026-01-06 12:02:39.925904+00
ESP32_DEMO_01	Simulateur Demo 1	ESP32	\N	LL	active	2026-01-07 10:22:43.807216+00	\N	\N	2026-01-06 12:02:48.519871+00	2026-01-06 12:02:48.519871+00
\.


--
-- Data for Name: sqal_ml_models; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.sqal_ml_models (model_id, model_name, model_type, model_version, model_file_path, model_size_mb, accuracy, precision_score, recall_score, f1_score, training_samples_count, training_duration_seconds, training_loss, validation_loss, framework, hyperparameters, features_used, status, is_production, trained_at, deployed_at, created_at) FROM stdin;
\.


--
-- Data for Name: sqal_pending_lots; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.sqal_pending_lots (id, code_lot, gaveur_id, gaveur_nom, site, genetique, poids_moyen_final, nb_canards_final, taux_mortalite, date_abattage, date_inspection_sqal, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sqal_sensor_samples; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.sqal_sensor_samples ("time", sample_id, device_id, lot_id, vl53l8ch_distance_matrix, vl53l8ch_reflectance_matrix, vl53l8ch_amplitude_matrix, vl53l8ch_integration_time, vl53l8ch_temperature_c, vl53l8ch_volume_mm3, vl53l8ch_avg_height_mm, vl53l8ch_max_height_mm, vl53l8ch_min_height_mm, vl53l8ch_surface_uniformity, vl53l8ch_bins_analysis, vl53l8ch_reflectance_analysis, vl53l8ch_amplitude_consistency, vl53l8ch_quality_score, vl53l8ch_grade, vl53l8ch_score_breakdown, vl53l8ch_defects, as7341_channels, as7341_integration_time, as7341_gain, as7341_freshness_index, as7341_fat_quality_index, as7341_oxidation_index, as7341_spectral_analysis, as7341_color_analysis, as7341_quality_score, as7341_grade, as7341_score_breakdown, as7341_defects, fusion_final_score, fusion_final_grade, fusion_vl53l8ch_score, fusion_as7341_score, fusion_defects, fusion_is_compliant, meta_firmware_version, meta_temperature_c, meta_humidity_percent, meta_config_profile, created_at, poids_foie_estime_g) FROM stdin;
\.


--
-- Data for Name: statistiques_globales; Type: TABLE DATA; Schema: public; Owner: gaveurs_admin
--

COPY public.statistiques_globales (id, site_code, periode, date_debut, date_fin, nb_lots, nb_gaveurs_actifs, production_totale_kg, itm_moyen, sigma_moyen, mortalite_moyenne, tendance_itm, tendance_mortalite, created_at) FROM stdin;
\.


--
-- Name: chunk_column_stats_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('_timescaledb_catalog.chunk_column_stats_id_seq', 1, false);


--
-- Name: chunk_constraint_name; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('_timescaledb_catalog.chunk_constraint_name', 617, true);


--
-- Name: chunk_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('_timescaledb_catalog.chunk_id_seq', 220, true);


--
-- Name: continuous_agg_migrate_plan_step_step_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('_timescaledb_catalog.continuous_agg_migrate_plan_step_step_id_seq', 1, false);


--
-- Name: dimension_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('_timescaledb_catalog.dimension_id_seq', 17, true);


--
-- Name: dimension_slice_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('_timescaledb_catalog.dimension_slice_id_seq', 219, true);


--
-- Name: hypertable_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_catalog; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('_timescaledb_catalog.hypertable_id_seq', 24, true);


--
-- Name: bgw_job_id_seq; Type: SEQUENCE SET; Schema: _timescaledb_config; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('_timescaledb_config.bgw_job_id_seq', 1018, true);


--
-- Name: abattoirs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.abattoirs_id_seq', 5, true);


--
-- Name: alertes_euralis_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.alertes_euralis_id_seq', 1, false);


--
-- Name: anomalies_detectees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.anomalies_detectees_id_seq', 1, false);


--
-- Name: bug_metrics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.bug_metrics_id_seq', 1, false);


--
-- Name: canards_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.canards_id_seq', 101, true);


--
-- Name: consumer_feedback_ml_data_ml_data_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.consumer_feedback_ml_data_ml_data_id_seq', 1, false);


--
-- Name: consumer_feedback_ml_insights_insight_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.consumer_feedback_ml_insights_insight_id_seq', 1, false);


--
-- Name: consumer_feedbacks_feedback_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.consumer_feedbacks_feedback_id_seq', 1, false);


--
-- Name: consumer_products_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.consumer_products_seq', 1, false);


--
-- Name: corrections_doses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.corrections_doses_id_seq', 1, false);


--
-- Name: formules_pysr_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.formules_pysr_id_seq', 1, false);


--
-- Name: gavage_lot_quotidien_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.gavage_lot_quotidien_id_seq', 43, true);


--
-- Name: gaveurs_clusters_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.gaveurs_clusters_id_seq', 1, false);


--
-- Name: gaveurs_euralis_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.gaveurs_euralis_id_seq', 1, false);


--
-- Name: gaveurs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.gaveurs_id_seq', 15, true);


--
-- Name: lot_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.lot_events_id_seq', 1, false);


--
-- Name: lot_mais_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.lot_mais_id_seq', 7, true);


--
-- Name: lots_gavage_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.lots_gavage_id_seq', 8000, true);


--
-- Name: lots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.lots_id_seq', 2, true);


--
-- Name: ml_models_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.ml_models_id_seq', 1, false);


--
-- Name: mortalite_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.mortalite_id_seq', 1, false);


--
-- Name: planning_abattages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.planning_abattages_id_seq', 1, false);


--
-- Name: predictions_courbes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.predictions_courbes_id_seq', 1, false);


--
-- Name: previsions_production_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.previsions_production_id_seq', 1, false);


--
-- Name: sites_euralis_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.sites_euralis_id_seq', 3, true);


--
-- Name: sqal_alerts_alert_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.sqal_alerts_alert_id_seq', 1, false);


--
-- Name: sqal_ml_models_model_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.sqal_ml_models_model_id_seq', 1, false);


--
-- Name: sqal_pending_lots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.sqal_pending_lots_id_seq', 1, false);


--
-- Name: statistiques_globales_id_seq; Type: SEQUENCE SET; Schema: public; Owner: gaveurs_admin
--

SELECT pg_catalog.setval('public.statistiques_globales_id_seq', 1, false);


--
-- Name: lots lots_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.lots
    ADD CONSTRAINT lots_pkey PRIMARY KEY (id);


--
-- Name: stats_lots; Type: MATERIALIZED VIEW; Schema: public; Owner: gaveurs_admin
--

CREATE MATERIALIZED VIEW public.stats_lots AS
 SELECT l.id AS lot_id,
    l.code_lot,
    l.statut,
    l.nombre_jours_gavage_ecoules,
    ((l.date_fin_gavage_prevue - l.date_debut_gavage) + 1) AS nombre_jours_prevus,
    round((((l.nombre_jours_gavage_ecoules)::numeric / (NULLIF(((l.date_fin_gavage_prevue - l.date_debut_gavage) + 1), 0))::numeric) * (100)::numeric), 2) AS pourcent_avancement,
    l.poids_moyen_initial,
    l.poids_moyen_actuel,
    l.objectif_poids_final,
    (l.poids_moyen_actuel - l.poids_moyen_initial) AS gain_total,
    round(((l.poids_moyen_actuel - l.poids_moyen_initial) / (NULLIF(l.nombre_jours_gavage_ecoules, 0))::numeric), 2) AS gain_moyen_jour,
    COALESCE(sum(g.dose_totale_jour), (0)::numeric) AS dose_totale_donnee,
    l.objectif_quantite_mais,
    round(((COALESCE(sum(g.dose_totale_jour), (0)::numeric) / (NULLIF(l.objectif_quantite_mais, 0))::numeric) * (100)::numeric), 2) AS pourcent_objectif_dose,
    round(avg(
        CASE
            WHEN g.suit_courbe_theorique THEN 100
            ELSE 0
        END), 2) AS taux_conformite_declare,
    round(avg(abs(COALESCE(g.ecart_poids_pourcent, (0)::numeric))), 2) AS ecart_moyen_poids,
    count(
        CASE
            WHEN (abs(COALESCE(g.ecart_poids_pourcent, (0)::numeric)) > (10)::numeric) THEN 1
            ELSE NULL::integer
        END) AS jours_hors_tolerance,
    l.nombre_mortalite,
    l.taux_mortalite,
    count(
        CASE
            WHEN g.alerte_generee THEN 1
            ELSE NULL::integer
        END) AS nombre_alertes,
    l.updated_at AS derniere_mise_a_jour
   FROM (public.lots l
     LEFT JOIN public.gavage_lot_quotidien g ON ((g.lot_id = l.id)))
  GROUP BY l.id
  WITH NO DATA;


ALTER TABLE public.stats_lots OWNER TO gaveurs_admin;

--
-- Name: _hyper_9_1_chunk 1_3_alertes_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_9_1_chunk
    ADD CONSTRAINT "1_3_alertes_pkey" PRIMARY KEY ("time", canard_id);


--
-- Name: _hyper_24_219_chunk 219_615_gavage_data_lots_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_24_219_chunk
    ADD CONSTRAINT "219_615_gavage_data_lots_pkey" PRIMARY KEY ("time", lot_gavage_id, repas);


--
-- Name: _hyper_24_220_chunk 220_617_gavage_data_lots_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_24_220_chunk
    ADD CONSTRAINT "220_617_gavage_data_lots_pkey" PRIMARY KEY ("time", lot_gavage_id, repas);


--
-- Name: _hyper_22_22_chunk 22_43_unique_lot_date; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_22_chunk
    ADD CONSTRAINT "22_43_unique_lot_date" UNIQUE (lot_id, date_gavage);


--
-- Name: _hyper_1_24_chunk 24_45_doses_journalieres_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_1_24_chunk
    ADD CONSTRAINT "24_45_doses_journalieres_pkey" PRIMARY KEY ("time", lot_id, jour_gavage);


--
-- Name: _hyper_1_25_chunk 25_47_doses_journalieres_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_1_25_chunk
    ADD CONSTRAINT "25_47_doses_journalieres_pkey" PRIMARY KEY ("time", lot_id, jour_gavage);


--
-- Name: _hyper_22_26_chunk 26_49_unique_lot_date; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_26_chunk
    ADD CONSTRAINT "26_49_unique_lot_date" UNIQUE (lot_id, date_gavage);


--
-- Name: _hyper_16_27_chunk 27_52_sqal_sensor_samples_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_16_27_chunk
    ADD CONSTRAINT "27_52_sqal_sensor_samples_pkey" PRIMARY KEY ("time", sample_id);


--
-- Name: _hyper_5_2_chunk 2_6_gavage_data_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_5_2_chunk
    ADD CONSTRAINT "2_6_gavage_data_pkey" PRIMARY KEY ("time", canard_id);


--
-- Name: _hyper_5_3_chunk 3_9_gavage_data_pkey; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_5_3_chunk
    ADD CONSTRAINT "3_9_gavage_data_pkey" PRIMARY KEY ("time", canard_id);


--
-- Name: _hyper_22_6_chunk 6_13_unique_lot_date; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_6_chunk
    ADD CONSTRAINT "6_13_unique_lot_date" UNIQUE (lot_id, date_gavage);


--
-- Name: _hyper_22_7_chunk 7_15_unique_lot_date; Type: CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_7_chunk
    ADD CONSTRAINT "7_15_unique_lot_date" UNIQUE (lot_id, date_gavage);


--
-- Name: abattoirs abattoirs_numero_agrement_key; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.abattoirs
    ADD CONSTRAINT abattoirs_numero_agrement_key UNIQUE (numero_agrement);


--
-- Name: abattoirs abattoirs_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.abattoirs
    ADD CONSTRAINT abattoirs_pkey PRIMARY KEY (id);


--
-- Name: alertes_euralis alertes_euralis_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.alertes_euralis
    ADD CONSTRAINT alertes_euralis_pkey PRIMARY KEY ("time", id);


--
-- Name: alertes alertes_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.alertes
    ADD CONSTRAINT alertes_pkey PRIMARY KEY ("time", canard_id);


--
-- Name: anomalies_detectees anomalies_detectees_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.anomalies_detectees
    ADD CONSTRAINT anomalies_detectees_pkey PRIMARY KEY (id);


--
-- Name: blockchain blockchain_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.blockchain
    ADD CONSTRAINT blockchain_pkey PRIMARY KEY (index, "timestamp");


--
-- Name: bug_comments bug_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.bug_comments
    ADD CONSTRAINT bug_comments_pkey PRIMARY KEY (id);


--
-- Name: bug_metrics bug_metrics_date_key; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.bug_metrics
    ADD CONSTRAINT bug_metrics_date_key UNIQUE (date);


--
-- Name: bug_metrics bug_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.bug_metrics
    ADD CONSTRAINT bug_metrics_pkey PRIMARY KEY (id);


--
-- Name: bug_reports bug_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.bug_reports
    ADD CONSTRAINT bug_reports_pkey PRIMARY KEY (id);


--
-- Name: canards canards_numero_identification_key; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.canards
    ADD CONSTRAINT canards_numero_identification_key UNIQUE (numero_identification);


--
-- Name: canards canards_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.canards
    ADD CONSTRAINT canards_pkey PRIMARY KEY (id);


--
-- Name: consumer_feedback_ml_data consumer_feedback_ml_data_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.consumer_feedback_ml_data
    ADD CONSTRAINT consumer_feedback_ml_data_pkey PRIMARY KEY (ml_data_id);


--
-- Name: consumer_feedback_ml_insights consumer_feedback_ml_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.consumer_feedback_ml_insights
    ADD CONSTRAINT consumer_feedback_ml_insights_pkey PRIMARY KEY (insight_id);


--
-- Name: consumer_feedbacks consumer_feedbacks_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.consumer_feedbacks
    ADD CONSTRAINT consumer_feedbacks_pkey PRIMARY KEY ("time", feedback_id);


--
-- Name: consumer_products consumer_products_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.consumer_products
    ADD CONSTRAINT consumer_products_pkey PRIMARY KEY (product_id);


--
-- Name: consumer_products consumer_products_qr_code_key; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.consumer_products
    ADD CONSTRAINT consumer_products_qr_code_key UNIQUE (qr_code);


--
-- Name: corrections_doses corrections_doses_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.corrections_doses
    ADD CONSTRAINT corrections_doses_pkey PRIMARY KEY (id);


--
-- Name: doses_journalieres doses_journalieres_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.doses_journalieres
    ADD CONSTRAINT doses_journalieres_pkey PRIMARY KEY ("time", lot_id, jour_gavage);


--
-- Name: formules_pysr formules_pysr_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.formules_pysr
    ADD CONSTRAINT formules_pysr_pkey PRIMARY KEY (id);


--
-- Name: formules_pysr formules_pysr_site_code_souche_key; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.formules_pysr
    ADD CONSTRAINT formules_pysr_site_code_souche_key UNIQUE (site_code, souche);


--
-- Name: gavage_data_lots gavage_data_lots_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.gavage_data_lots
    ADD CONSTRAINT gavage_data_lots_pkey PRIMARY KEY ("time", lot_gavage_id, repas);


--
-- Name: gavage_data gavage_data_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.gavage_data
    ADD CONSTRAINT gavage_data_pkey PRIMARY KEY ("time", canard_id);


--
-- Name: gaveurs_clusters gaveurs_clusters_gaveur_id_key; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.gaveurs_clusters
    ADD CONSTRAINT gaveurs_clusters_gaveur_id_key UNIQUE (gaveur_id);


--
-- Name: gaveurs_clusters gaveurs_clusters_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.gaveurs_clusters
    ADD CONSTRAINT gaveurs_clusters_pkey PRIMARY KEY (id);


--
-- Name: gaveurs gaveurs_email_key; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.gaveurs
    ADD CONSTRAINT gaveurs_email_key UNIQUE (email);


--
-- Name: gaveurs_euralis gaveurs_euralis_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.gaveurs_euralis
    ADD CONSTRAINT gaveurs_euralis_pkey PRIMARY KEY (id);


--
-- Name: gaveurs gaveurs_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.gaveurs
    ADD CONSTRAINT gaveurs_pkey PRIMARY KEY (id);


--
-- Name: lot_events lot_events_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.lot_events
    ADD CONSTRAINT lot_events_pkey PRIMARY KEY (id);


--
-- Name: lot_mais lot_mais_numero_lot_key; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.lot_mais
    ADD CONSTRAINT lot_mais_numero_lot_key UNIQUE (numero_lot);


--
-- Name: lot_mais lot_mais_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.lot_mais
    ADD CONSTRAINT lot_mais_pkey PRIMARY KEY (id);


--
-- Name: lots lots_code_lot_key; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.lots
    ADD CONSTRAINT lots_code_lot_key UNIQUE (code_lot);


--
-- Name: lots_gavage lots_gavage_code_lot_key; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.lots_gavage
    ADD CONSTRAINT lots_gavage_code_lot_key UNIQUE (code_lot);


--
-- Name: lots_gavage lots_gavage_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.lots_gavage
    ADD CONSTRAINT lots_gavage_pkey PRIMARY KEY (id);


--
-- Name: lots_registry lots_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.lots_registry
    ADD CONSTRAINT lots_registry_pkey PRIMARY KEY (lot_id);


--
-- Name: ml_models ml_models_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.ml_models
    ADD CONSTRAINT ml_models_pkey PRIMARY KEY (id);


--
-- Name: mortalite mortalite_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.mortalite
    ADD CONSTRAINT mortalite_pkey PRIMARY KEY (id);


--
-- Name: planning_abattages planning_abattages_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.planning_abattages
    ADD CONSTRAINT planning_abattages_pkey PRIMARY KEY (id);


--
-- Name: predictions_courbes predictions_courbes_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.predictions_courbes
    ADD CONSTRAINT predictions_courbes_pkey PRIMARY KEY (id);


--
-- Name: previsions_production previsions_production_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.previsions_production
    ADD CONSTRAINT previsions_production_pkey PRIMARY KEY (id);


--
-- Name: previsions_production previsions_production_site_code_date_prevision_horizon_jour_key; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.previsions_production
    ADD CONSTRAINT previsions_production_site_code_date_prevision_horizon_jour_key UNIQUE (site_code, date_prevision, horizon_jours);


--
-- Name: sites_euralis sites_euralis_code_key; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.sites_euralis
    ADD CONSTRAINT sites_euralis_code_key UNIQUE (code);


--
-- Name: sites_euralis sites_euralis_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.sites_euralis
    ADD CONSTRAINT sites_euralis_pkey PRIMARY KEY (id);


--
-- Name: sqal_alerts sqal_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.sqal_alerts
    ADD CONSTRAINT sqal_alerts_pkey PRIMARY KEY ("time", alert_id);


--
-- Name: sqal_devices sqal_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.sqal_devices
    ADD CONSTRAINT sqal_devices_pkey PRIMARY KEY (device_id);


--
-- Name: sqal_ml_models sqal_ml_models_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.sqal_ml_models
    ADD CONSTRAINT sqal_ml_models_pkey PRIMARY KEY (model_id);


--
-- Name: sqal_pending_lots sqal_pending_lots_code_lot_key; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.sqal_pending_lots
    ADD CONSTRAINT sqal_pending_lots_code_lot_key UNIQUE (code_lot);


--
-- Name: sqal_pending_lots sqal_pending_lots_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.sqal_pending_lots
    ADD CONSTRAINT sqal_pending_lots_pkey PRIMARY KEY (id);


--
-- Name: sqal_sensor_samples sqal_sensor_samples_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.sqal_sensor_samples
    ADD CONSTRAINT sqal_sensor_samples_pkey PRIMARY KEY ("time", sample_id);


--
-- Name: statistiques_globales statistiques_globales_pkey; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.statistiques_globales
    ADD CONSTRAINT statistiques_globales_pkey PRIMARY KEY (id);


--
-- Name: statistiques_globales statistiques_globales_site_code_periode_date_debut_date_fin_key; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.statistiques_globales
    ADD CONSTRAINT statistiques_globales_site_code_periode_date_debut_date_fin_key UNIQUE (site_code, periode, date_debut, date_fin);


--
-- Name: gavage_lot_quotidien unique_lot_date; Type: CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.gavage_lot_quotidien
    ADD CONSTRAINT unique_lot_date UNIQUE (lot_id, date_gavage);


--
-- Name: lots valid_poids_progression; Type: CHECK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE public.lots
    ADD CONSTRAINT valid_poids_progression CHECK ((poids_moyen_actuel >= poids_moyen_initial)) NOT VALID;


--
-- Name: _hyper_16_27_chunk_idx_sqal_samples_device; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_16_27_chunk_idx_sqal_samples_device ON _timescaledb_internal._hyper_16_27_chunk USING btree (device_id, "time" DESC);


--
-- Name: _hyper_16_27_chunk_idx_sqal_samples_grade; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_16_27_chunk_idx_sqal_samples_grade ON _timescaledb_internal._hyper_16_27_chunk USING btree (fusion_final_grade);


--
-- Name: _hyper_16_27_chunk_idx_sqal_samples_lot; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_16_27_chunk_idx_sqal_samples_lot ON _timescaledb_internal._hyper_16_27_chunk USING btree (lot_id) WHERE (lot_id IS NOT NULL);


--
-- Name: _hyper_16_27_chunk_idx_sqal_samples_lot_poids; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_16_27_chunk_idx_sqal_samples_lot_poids ON _timescaledb_internal._hyper_16_27_chunk USING btree (lot_id, poids_foie_estime_g) WHERE ((lot_id IS NOT NULL) AND (poids_foie_estime_g IS NOT NULL));


--
-- Name: _hyper_16_27_chunk_idx_sqal_samples_sample_id; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_16_27_chunk_idx_sqal_samples_sample_id ON _timescaledb_internal._hyper_16_27_chunk USING btree (sample_id);


--
-- Name: _hyper_16_27_chunk_idx_sqal_samples_score; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_16_27_chunk_idx_sqal_samples_score ON _timescaledb_internal._hyper_16_27_chunk USING btree (fusion_final_score);


--
-- Name: _hyper_16_27_chunk_sqal_sensor_samples_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_16_27_chunk_sqal_sensor_samples_time_idx ON _timescaledb_internal._hyper_16_27_chunk USING btree ("time" DESC);


--
-- Name: _hyper_17_28_chunk__materialized_hypertable_17_bucket_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_17_28_chunk__materialized_hypertable_17_bucket_idx ON _timescaledb_internal._hyper_17_28_chunk USING btree (bucket DESC);


--
-- Name: _hyper_17_28_chunk__materialized_hypertable_17_device_id_bucket; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_17_28_chunk__materialized_hypertable_17_device_id_bucket ON _timescaledb_internal._hyper_17_28_chunk USING btree (device_id, bucket DESC);


--
-- Name: _hyper_18_29_chunk__materialized_hypertable_18_day_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_18_29_chunk__materialized_hypertable_18_day_idx ON _timescaledb_internal._hyper_18_29_chunk USING btree (day DESC);


--
-- Name: _hyper_18_29_chunk__materialized_hypertable_18_site_code_day_id; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_18_29_chunk__materialized_hypertable_18_site_code_day_id ON _timescaledb_internal._hyper_18_29_chunk USING btree (site_code, day DESC);


--
-- Name: _hyper_1_24_chunk_doses_journalieres_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_1_24_chunk_doses_journalieres_time_idx ON _timescaledb_internal._hyper_1_24_chunk USING btree ("time" DESC);


--
-- Name: _hyper_1_24_chunk_idx_doses_code_lot; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_1_24_chunk_idx_doses_code_lot ON _timescaledb_internal._hyper_1_24_chunk USING btree (code_lot, "time" DESC);


--
-- Name: _hyper_1_24_chunk_idx_doses_jour; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_1_24_chunk_idx_doses_jour ON _timescaledb_internal._hyper_1_24_chunk USING btree (jour_gavage);


--
-- Name: _hyper_1_24_chunk_idx_doses_jour_moment; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_1_24_chunk_idx_doses_jour_moment ON _timescaledb_internal._hyper_1_24_chunk USING btree (jour, moment);


--
-- Name: _hyper_1_24_chunk_idx_doses_lot; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_1_24_chunk_idx_doses_lot ON _timescaledb_internal._hyper_1_24_chunk USING btree (lot_id, jour_gavage);


--
-- Name: _hyper_1_25_chunk_doses_journalieres_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_1_25_chunk_doses_journalieres_time_idx ON _timescaledb_internal._hyper_1_25_chunk USING btree ("time" DESC);


--
-- Name: _hyper_1_25_chunk_idx_doses_code_lot; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_1_25_chunk_idx_doses_code_lot ON _timescaledb_internal._hyper_1_25_chunk USING btree (code_lot, "time" DESC);


--
-- Name: _hyper_1_25_chunk_idx_doses_jour; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_1_25_chunk_idx_doses_jour ON _timescaledb_internal._hyper_1_25_chunk USING btree (jour_gavage);


--
-- Name: _hyper_1_25_chunk_idx_doses_jour_moment; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_1_25_chunk_idx_doses_jour_moment ON _timescaledb_internal._hyper_1_25_chunk USING btree (jour, moment);


--
-- Name: _hyper_1_25_chunk_idx_doses_lot; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_1_25_chunk_idx_doses_lot ON _timescaledb_internal._hyper_1_25_chunk USING btree (lot_id, jour_gavage);


--
-- Name: _hyper_22_22_chunk_gavage_lot_quotidien_date_gavage_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_22_22_chunk_gavage_lot_quotidien_date_gavage_idx ON _timescaledb_internal._hyper_22_22_chunk USING btree (date_gavage DESC);


--
-- Name: _hyper_22_22_chunk_idx_gavage_alerte; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_22_22_chunk_idx_gavage_alerte ON _timescaledb_internal._hyper_22_22_chunk USING btree (alerte_generee) WHERE alerte_generee;


--
-- Name: _hyper_22_22_chunk_idx_gavage_jour; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_22_22_chunk_idx_gavage_jour ON _timescaledb_internal._hyper_22_22_chunk USING btree (jour_gavage);


--
-- Name: _hyper_22_22_chunk_idx_gavage_lot; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_22_22_chunk_idx_gavage_lot ON _timescaledb_internal._hyper_22_22_chunk USING btree (lot_id, date_gavage DESC);


--
-- Name: _hyper_22_26_chunk_gavage_lot_quotidien_date_gavage_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_22_26_chunk_gavage_lot_quotidien_date_gavage_idx ON _timescaledb_internal._hyper_22_26_chunk USING btree (date_gavage DESC);


--
-- Name: _hyper_22_26_chunk_idx_gavage_alerte; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_22_26_chunk_idx_gavage_alerte ON _timescaledb_internal._hyper_22_26_chunk USING btree (alerte_generee) WHERE alerte_generee;


--
-- Name: _hyper_22_26_chunk_idx_gavage_jour; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_22_26_chunk_idx_gavage_jour ON _timescaledb_internal._hyper_22_26_chunk USING btree (jour_gavage);


--
-- Name: _hyper_22_26_chunk_idx_gavage_lot; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_22_26_chunk_idx_gavage_lot ON _timescaledb_internal._hyper_22_26_chunk USING btree (lot_id, date_gavage DESC);


--
-- Name: _hyper_22_6_chunk_gavage_lot_quotidien_date_gavage_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_22_6_chunk_gavage_lot_quotidien_date_gavage_idx ON _timescaledb_internal._hyper_22_6_chunk USING btree (date_gavage DESC);


--
-- Name: _hyper_22_6_chunk_idx_gavage_alerte; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_22_6_chunk_idx_gavage_alerte ON _timescaledb_internal._hyper_22_6_chunk USING btree (alerte_generee) WHERE alerte_generee;


--
-- Name: _hyper_22_6_chunk_idx_gavage_jour; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_22_6_chunk_idx_gavage_jour ON _timescaledb_internal._hyper_22_6_chunk USING btree (jour_gavage);


--
-- Name: _hyper_22_6_chunk_idx_gavage_lot; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_22_6_chunk_idx_gavage_lot ON _timescaledb_internal._hyper_22_6_chunk USING btree (lot_id, date_gavage DESC);


--
-- Name: _hyper_22_7_chunk_gavage_lot_quotidien_date_gavage_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_22_7_chunk_gavage_lot_quotidien_date_gavage_idx ON _timescaledb_internal._hyper_22_7_chunk USING btree (date_gavage DESC);


--
-- Name: _hyper_22_7_chunk_idx_gavage_alerte; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_22_7_chunk_idx_gavage_alerte ON _timescaledb_internal._hyper_22_7_chunk USING btree (alerte_generee) WHERE alerte_generee;


--
-- Name: _hyper_22_7_chunk_idx_gavage_jour; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_22_7_chunk_idx_gavage_jour ON _timescaledb_internal._hyper_22_7_chunk USING btree (jour_gavage);


--
-- Name: _hyper_22_7_chunk_idx_gavage_lot; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_22_7_chunk_idx_gavage_lot ON _timescaledb_internal._hyper_22_7_chunk USING btree (lot_id, date_gavage DESC);


--
-- Name: _hyper_23_8_chunk__materialized_hypertable_23_jour_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_23_8_chunk__materialized_hypertable_23_jour_idx ON _timescaledb_internal._hyper_23_8_chunk USING btree (jour DESC);


--
-- Name: _hyper_23_8_chunk__materialized_hypertable_23_lot_id_jour_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_23_8_chunk__materialized_hypertable_23_lot_id_jour_idx ON _timescaledb_internal._hyper_23_8_chunk USING btree (lot_id, jour DESC);


--
-- Name: _hyper_24_219_chunk_gavage_data_lots_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_24_219_chunk_gavage_data_lots_time_idx ON _timescaledb_internal._hyper_24_219_chunk USING btree ("time" DESC);


--
-- Name: _hyper_24_219_chunk_idx_gavage_lots_jour; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_24_219_chunk_idx_gavage_lots_jour ON _timescaledb_internal._hyper_24_219_chunk USING btree (jour_gavage, "time" DESC);


--
-- Name: _hyper_24_219_chunk_idx_gavage_lots_lot_time; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_24_219_chunk_idx_gavage_lots_lot_time ON _timescaledb_internal._hyper_24_219_chunk USING btree (lot_gavage_id, "time" DESC);


--
-- Name: _hyper_24_220_chunk_gavage_data_lots_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_24_220_chunk_gavage_data_lots_time_idx ON _timescaledb_internal._hyper_24_220_chunk USING btree ("time" DESC);


--
-- Name: _hyper_24_220_chunk_idx_gavage_lots_jour; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_24_220_chunk_idx_gavage_lots_jour ON _timescaledb_internal._hyper_24_220_chunk USING btree (jour_gavage, "time" DESC);


--
-- Name: _hyper_24_220_chunk_idx_gavage_lots_lot_time; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_24_220_chunk_idx_gavage_lots_lot_time ON _timescaledb_internal._hyper_24_220_chunk USING btree (lot_gavage_id, "time" DESC);


--
-- Name: _hyper_5_2_chunk_gavage_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_5_2_chunk_gavage_data_time_idx ON _timescaledb_internal._hyper_5_2_chunk USING btree ("time" DESC);


--
-- Name: _hyper_5_2_chunk_idx_gavage_alertes; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_5_2_chunk_idx_gavage_alertes ON _timescaledb_internal._hyper_5_2_chunk USING btree (alerte_generee, "time" DESC) WHERE alerte_generee;


--
-- Name: _hyper_5_2_chunk_idx_gavage_canard_time; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_5_2_chunk_idx_gavage_canard_time ON _timescaledb_internal._hyper_5_2_chunk USING btree (canard_id, "time" DESC);


--
-- Name: _hyper_5_3_chunk_gavage_data_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_5_3_chunk_gavage_data_time_idx ON _timescaledb_internal._hyper_5_3_chunk USING btree ("time" DESC);


--
-- Name: _hyper_5_3_chunk_idx_gavage_alertes; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_5_3_chunk_idx_gavage_alertes ON _timescaledb_internal._hyper_5_3_chunk USING btree (alerte_generee, "time" DESC) WHERE alerte_generee;


--
-- Name: _hyper_5_3_chunk_idx_gavage_canard_time; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_5_3_chunk_idx_gavage_canard_time ON _timescaledb_internal._hyper_5_3_chunk USING btree (canard_id, "time" DESC);


--
-- Name: _hyper_7_4_chunk__materialized_hypertable_7_canard_id_day_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_7_4_chunk__materialized_hypertable_7_canard_id_day_idx ON _timescaledb_internal._hyper_7_4_chunk USING btree (canard_id, day DESC);


--
-- Name: _hyper_7_4_chunk__materialized_hypertable_7_day_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_7_4_chunk__materialized_hypertable_7_day_idx ON _timescaledb_internal._hyper_7_4_chunk USING btree (day DESC);


--
-- Name: _hyper_9_1_chunk_alertes_time_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_9_1_chunk_alertes_time_idx ON _timescaledb_internal._hyper_9_1_chunk USING btree ("time" DESC);


--
-- Name: _hyper_9_1_chunk_idx_alertes_canard; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_9_1_chunk_idx_alertes_canard ON _timescaledb_internal._hyper_9_1_chunk USING btree (canard_id);


--
-- Name: _hyper_9_1_chunk_idx_alertes_niveau; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_9_1_chunk_idx_alertes_niveau ON _timescaledb_internal._hyper_9_1_chunk USING btree (niveau, "time" DESC);


--
-- Name: _hyper_9_1_chunk_idx_alertes_non_acquittees; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_9_1_chunk_idx_alertes_non_acquittees ON _timescaledb_internal._hyper_9_1_chunk USING btree (acquittee, "time" DESC) WHERE (NOT acquittee);


--
-- Name: _hyper_9_1_chunk_idx_alertes_sms; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _hyper_9_1_chunk_idx_alertes_sms ON _timescaledb_internal._hyper_9_1_chunk USING btree (sms_envoye);


--
-- Name: _materialized_hypertable_14_bucket_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _materialized_hypertable_14_bucket_idx ON _timescaledb_internal._materialized_hypertable_14 USING btree (bucket DESC);


--
-- Name: _materialized_hypertable_14_lot_id_bucket_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _materialized_hypertable_14_lot_id_bucket_idx ON _timescaledb_internal._materialized_hypertable_14 USING btree (lot_id, bucket DESC);


--
-- Name: _materialized_hypertable_14_site_code_bucket_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _materialized_hypertable_14_site_code_bucket_idx ON _timescaledb_internal._materialized_hypertable_14 USING btree (site_code, bucket DESC);


--
-- Name: _materialized_hypertable_15_bucket_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _materialized_hypertable_15_bucket_idx ON _timescaledb_internal._materialized_hypertable_15 USING btree (bucket DESC);


--
-- Name: _materialized_hypertable_15_site_code_bucket_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _materialized_hypertable_15_site_code_bucket_idx ON _timescaledb_internal._materialized_hypertable_15 USING btree (site_code, bucket DESC);


--
-- Name: _materialized_hypertable_17_bucket_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _materialized_hypertable_17_bucket_idx ON _timescaledb_internal._materialized_hypertable_17 USING btree (bucket DESC);


--
-- Name: _materialized_hypertable_17_device_id_bucket_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _materialized_hypertable_17_device_id_bucket_idx ON _timescaledb_internal._materialized_hypertable_17 USING btree (device_id, bucket DESC);


--
-- Name: _materialized_hypertable_18_day_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _materialized_hypertable_18_day_idx ON _timescaledb_internal._materialized_hypertable_18 USING btree (day DESC);


--
-- Name: _materialized_hypertable_18_site_code_day_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _materialized_hypertable_18_site_code_day_idx ON _timescaledb_internal._materialized_hypertable_18 USING btree (site_code, day DESC);


--
-- Name: _materialized_hypertable_23_jour_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _materialized_hypertable_23_jour_idx ON _timescaledb_internal._materialized_hypertable_23 USING btree (jour DESC);


--
-- Name: _materialized_hypertable_23_lot_id_jour_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _materialized_hypertable_23_lot_id_jour_idx ON _timescaledb_internal._materialized_hypertable_23 USING btree (lot_id, jour DESC);


--
-- Name: _materialized_hypertable_7_canard_id_day_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _materialized_hypertable_7_canard_id_day_idx ON _timescaledb_internal._materialized_hypertable_7 USING btree (canard_id, day DESC);


--
-- Name: _materialized_hypertable_7_day_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _materialized_hypertable_7_day_idx ON _timescaledb_internal._materialized_hypertable_7 USING btree (day DESC);


--
-- Name: _materialized_hypertable_8_genetique_week_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _materialized_hypertable_8_genetique_week_idx ON _timescaledb_internal._materialized_hypertable_8 USING btree (genetique, week DESC);


--
-- Name: _materialized_hypertable_8_week_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX _materialized_hypertable_8_week_idx ON _timescaledb_internal._materialized_hypertable_8 USING btree (week DESC);


--
-- Name: compress_hyper_6_23_chunk_canard_id__ts_meta_min_1__ts_meta_idx; Type: INDEX; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE INDEX compress_hyper_6_23_chunk_canard_id__ts_meta_min_1__ts_meta_idx ON _timescaledb_internal.compress_hyper_6_23_chunk USING btree (canard_id, _ts_meta_min_1 DESC, _ts_meta_max_1 DESC);


--
-- Name: alertes_euralis_time_idx; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX alertes_euralis_time_idx ON public.alertes_euralis USING btree ("time" DESC);


--
-- Name: alertes_time_idx; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX alertes_time_idx ON public.alertes USING btree ("time" DESC);


--
-- Name: blockchain_timestamp_idx; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX blockchain_timestamp_idx ON public.blockchain USING btree ("timestamp" DESC);


--
-- Name: consumer_feedbacks_time_idx; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX consumer_feedbacks_time_idx ON public.consumer_feedbacks USING btree ("time" DESC);


--
-- Name: doses_journalieres_time_idx; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX doses_journalieres_time_idx ON public.doses_journalieres USING btree ("time" DESC);


--
-- Name: gavage_data_lots_time_idx; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX gavage_data_lots_time_idx ON public.gavage_data_lots USING btree ("time" DESC);


--
-- Name: gavage_data_time_idx; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX gavage_data_time_idx ON public.gavage_data USING btree ("time" DESC);


--
-- Name: gavage_lot_quotidien_date_gavage_idx; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX gavage_lot_quotidien_date_gavage_idx ON public.gavage_lot_quotidien USING btree (date_gavage DESC);


--
-- Name: idx_alertes_acquittee; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_alertes_acquittee ON public.alertes_euralis USING btree (acquittee);


--
-- Name: idx_alertes_canard; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_alertes_canard ON public.alertes USING btree (canard_id);


--
-- Name: idx_alertes_criticite; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_alertes_criticite ON public.alertes_euralis USING btree (criticite);


--
-- Name: idx_alertes_gaveur; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_alertes_gaveur ON public.alertes_euralis USING btree (gaveur_id);


--
-- Name: idx_alertes_lot; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_alertes_lot ON public.alertes_euralis USING btree (lot_id);


--
-- Name: idx_alertes_niveau; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_alertes_niveau ON public.alertes USING btree (niveau, "time" DESC);


--
-- Name: idx_alertes_non_acquittees; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_alertes_non_acquittees ON public.alertes USING btree (acquittee, "time" DESC) WHERE (acquittee = false);


--
-- Name: idx_alertes_site; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_alertes_site ON public.alertes_euralis USING btree (site_code);


--
-- Name: idx_alertes_sms; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_alertes_sms ON public.alertes USING btree (sms_envoye);


--
-- Name: idx_alertes_type; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_alertes_type ON public.alertes_euralis USING btree (type_alerte);


--
-- Name: idx_anomalies_gaveur; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_anomalies_gaveur ON public.anomalies_detectees USING btree (gaveur_id);


--
-- Name: idx_anomalies_lot; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_anomalies_lot ON public.anomalies_detectees USING btree (lot_id);


--
-- Name: idx_anomalies_niveau; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_anomalies_niveau ON public.anomalies_detectees USING btree (niveau);


--
-- Name: idx_anomalies_site; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_anomalies_site ON public.anomalies_detectees USING btree (site_code);


--
-- Name: idx_anomalies_traitee; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_anomalies_traitee ON public.anomalies_detectees USING btree (traitee);


--
-- Name: idx_blockchain_canard; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_blockchain_canard ON public.blockchain USING btree (canard_id, "timestamp" DESC);


--
-- Name: idx_blockchain_hash; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_blockchain_hash ON public.blockchain USING btree (hash_actuel);


--
-- Name: idx_blockchain_type; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_blockchain_type ON public.blockchain USING btree (type_evenement, "timestamp" DESC);


--
-- Name: idx_bug_comments_bug_report_id; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_bug_comments_bug_report_id ON public.bug_comments USING btree (bug_report_id);


--
-- Name: idx_bug_comments_created_at; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_bug_comments_created_at ON public.bug_comments USING btree (created_at);


--
-- Name: idx_bug_metrics_date; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_bug_metrics_date ON public.bug_metrics USING btree (date DESC);


--
-- Name: idx_bug_reports_assigned_to; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_bug_reports_assigned_to ON public.bug_reports USING btree (assigned_to);


--
-- Name: idx_bug_reports_category; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_bug_reports_category ON public.bug_reports USING btree (category);


--
-- Name: idx_bug_reports_created_at; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_bug_reports_created_at ON public.bug_reports USING btree (created_at DESC);


--
-- Name: idx_bug_reports_device_id; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_bug_reports_device_id ON public.bug_reports USING btree (device_id);


--
-- Name: idx_bug_reports_priority; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_bug_reports_priority ON public.bug_reports USING btree (priority);


--
-- Name: idx_bug_reports_severity; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_bug_reports_severity ON public.bug_reports USING btree (severity);


--
-- Name: idx_bug_reports_status; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_bug_reports_status ON public.bug_reports USING btree (status);


--
-- Name: idx_canards_gaveur; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_canards_gaveur ON public.canards USING btree (gaveur_id);


--
-- Name: idx_canards_genetique; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_canards_genetique ON public.canards USING btree (genetique);


--
-- Name: idx_canards_lot; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_canards_lot ON public.canards USING btree (lot_id);


--
-- Name: idx_canards_numero; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_canards_numero ON public.canards USING btree (numero_identification);


--
-- Name: idx_canards_statut; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_canards_statut ON public.canards USING btree (statut);


--
-- Name: idx_clusters_cluster; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_clusters_cluster ON public.gaveurs_clusters USING btree (cluster_id);


--
-- Name: idx_clusters_gaveur; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_clusters_gaveur ON public.gaveurs_clusters USING btree (gaveur_id);


--
-- Name: idx_consumer_products_lot; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_consumer_products_lot ON public.consumer_products USING btree (lot_id);


--
-- Name: idx_consumer_products_qr; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_consumer_products_qr ON public.consumer_products USING btree (qr_code);


--
-- Name: idx_consumer_products_sample; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_consumer_products_sample ON public.consumer_products USING btree (sample_id);


--
-- Name: idx_consumer_products_site_date; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_consumer_products_site_date ON public.consumer_products USING btree (site_code, production_date);


--
-- Name: idx_corrections_canard; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_corrections_canard ON public.corrections_doses USING btree (canard_id, date DESC);


--
-- Name: idx_corrections_date; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_corrections_date ON public.corrections_doses USING btree (date DESC);


--
-- Name: idx_doses_code_lot; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_doses_code_lot ON public.doses_journalieres USING btree (code_lot, "time" DESC);


--
-- Name: idx_doses_jour; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_doses_jour ON public.doses_journalieres USING btree (jour_gavage);


--
-- Name: idx_doses_jour_moment; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_doses_jour_moment ON public.doses_journalieres USING btree (jour, moment);


--
-- Name: idx_doses_lot; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_doses_lot ON public.doses_journalieres USING btree (lot_id, jour_gavage);


--
-- Name: idx_feedbacks_product; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_feedbacks_product ON public.consumer_feedbacks USING btree (product_id, "time" DESC);


--
-- Name: idx_feedbacks_public; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_feedbacks_public ON public.consumer_feedbacks USING btree (is_public, "time" DESC) WHERE (is_public = true);


--
-- Name: idx_feedbacks_rating; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_feedbacks_rating ON public.consumer_feedbacks USING btree (overall_rating, "time" DESC);


--
-- Name: idx_formules_site_souche; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_formules_site_souche ON public.formules_pysr USING btree (site_code, souche);


--
-- Name: idx_gavage_alerte; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_gavage_alerte ON public.gavage_lot_quotidien USING btree (alerte_generee) WHERE (alerte_generee = true);


--
-- Name: idx_gavage_alertes; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_gavage_alertes ON public.gavage_data USING btree (alerte_generee, "time" DESC) WHERE (alerte_generee = true);


--
-- Name: idx_gavage_canard_time; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_gavage_canard_time ON public.gavage_data USING btree (canard_id, "time" DESC);


--
-- Name: idx_gavage_jour; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_gavage_jour ON public.gavage_lot_quotidien USING btree (jour_gavage);


--
-- Name: idx_gavage_lot; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_gavage_lot ON public.gavage_lot_quotidien USING btree (lot_id, date_gavage DESC);


--
-- Name: idx_gavage_lots_jour; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_gavage_lots_jour ON public.gavage_data_lots USING btree (jour_gavage, "time" DESC);


--
-- Name: idx_gavage_lots_lot_time; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_gavage_lots_lot_time ON public.gavage_data_lots USING btree (lot_gavage_id, "time" DESC);


--
-- Name: idx_gavage_lots_time; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_gavage_lots_time ON public.gavage_data_lots USING btree ("time" DESC);


--
-- Name: idx_gavage_time_bucket; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_gavage_time_bucket ON public.gavage_data USING btree ("time" DESC);


--
-- Name: idx_gaveurs_actif; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_gaveurs_actif ON public.gaveurs_euralis USING btree (actif);


--
-- Name: idx_gaveurs_email; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_gaveurs_email ON public.gaveurs_euralis USING btree (email);


--
-- Name: idx_gaveurs_site; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_gaveurs_site ON public.gaveurs_euralis USING btree (site_code);


--
-- Name: idx_gaveurs_telephone; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_gaveurs_telephone ON public.gaveurs USING btree (telephone);


--
-- Name: idx_lot_events_lot_id; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_lot_events_lot_id ON public.lot_events USING btree (lot_id, "timestamp" DESC);


--
-- Name: idx_lot_events_timestamp; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_lot_events_timestamp ON public.lot_events USING btree ("timestamp" DESC);


--
-- Name: idx_lot_events_type; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_lot_events_type ON public.lot_events USING btree (event_type);


--
-- Name: idx_lot_mais_numero; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_lot_mais_numero ON public.lot_mais USING btree (numero_lot);


--
-- Name: idx_lots_code; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_lots_code ON public.lots_gavage USING btree (code_lot);


--
-- Name: idx_lots_dates; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_lots_dates ON public.lots USING btree (date_debut_gavage, date_fin_gavage_prevue);


--
-- Name: idx_lots_debut; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_lots_debut ON public.lots_gavage USING btree (debut_lot);


--
-- Name: idx_lots_gaveur; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_lots_gaveur ON public.lots USING btree (gaveur_id);


--
-- Name: idx_lots_itm; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_lots_itm ON public.lots_gavage USING btree (itm);


--
-- Name: idx_lots_pret_abattage; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_lots_pret_abattage ON public.lots_gavage USING btree (pret_abattage) WHERE (pret_abattage = true);


--
-- Name: idx_lots_registry_created; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_lots_registry_created ON public.lots_registry USING btree (created_at DESC);


--
-- Name: idx_lots_registry_gaveur; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_lots_registry_gaveur ON public.lots_registry USING btree (gaveur_id);


--
-- Name: idx_lots_registry_status; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_lots_registry_status ON public.lots_registry USING btree (gavage_status);


--
-- Name: idx_lots_site; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_lots_site ON public.lots USING btree (site_origine);


--
-- Name: idx_lots_souche; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_lots_souche ON public.lots_gavage USING btree (souche);


--
-- Name: idx_lots_statut; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_lots_statut ON public.lots USING btree (statut);


--
-- Name: idx_lots_updated; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_lots_updated ON public.lots_gavage USING btree (updated_at DESC);


--
-- Name: idx_ml_data_lot; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_ml_data_lot ON public.consumer_feedback_ml_data USING btree (lot_id);


--
-- Name: idx_ml_data_site; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_ml_data_site ON public.consumer_feedback_ml_data USING btree (site_code, production_date);


--
-- Name: idx_ml_data_training; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_ml_data_training ON public.consumer_feedback_ml_data USING btree (used_for_training, train_test_split);


--
-- Name: idx_ml_insights_active; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_ml_insights_active ON public.consumer_feedback_ml_insights USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_ml_insights_model; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_ml_insights_model ON public.consumer_feedback_ml_insights USING btree (model_name, model_version);


--
-- Name: idx_ml_insights_site; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_ml_insights_site ON public.consumer_feedback_ml_insights USING btree (site_code, generated_at DESC);


--
-- Name: idx_ml_models_genetique; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_ml_models_genetique ON public.ml_models USING btree (genetique, created_at DESC);


--
-- Name: idx_mortalite_date; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_mortalite_date ON public.mortalite USING btree (date_deces DESC);


--
-- Name: idx_perf_sites_code; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE UNIQUE INDEX idx_perf_sites_code ON public.performances_sites USING btree (site_code);


--
-- Name: idx_planning_date_prevue; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_planning_date_prevue ON public.planning_abattages USING btree (date_abattage_prevue);


--
-- Name: idx_planning_lot; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_planning_lot ON public.planning_abattages USING btree (lot_id);


--
-- Name: idx_planning_site; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_planning_site ON public.planning_abattages USING btree (site_code);


--
-- Name: idx_planning_statut; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_planning_statut ON public.planning_abattages USING btree (statut);


--
-- Name: idx_predictions_canard; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_predictions_canard ON public.predictions_courbes USING btree (canard_id, date_prediction DESC);


--
-- Name: idx_previsions_horizon; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_previsions_horizon ON public.previsions_production USING btree (horizon_jours);


--
-- Name: idx_previsions_site_date; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_previsions_site_date ON public.previsions_production USING btree (site_code, date_prevision);


--
-- Name: idx_product_stats_lot; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_product_stats_lot ON public.consumer_product_stats USING btree (lot_id);


--
-- Name: idx_product_stats_product; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE UNIQUE INDEX idx_product_stats_product ON public.consumer_product_stats USING btree (product_id);


--
-- Name: idx_product_stats_rating; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_product_stats_rating ON public.consumer_product_stats USING btree (avg_overall_rating DESC);


--
-- Name: idx_product_stats_site; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_product_stats_site ON public.consumer_product_stats USING btree (site_code, production_date);


--
-- Name: idx_sites_code; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sites_code ON public.sites_euralis USING btree (code);


--
-- Name: idx_sqal_alerts_ack; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sqal_alerts_ack ON public.sqal_alerts USING btree (acknowledged);


--
-- Name: idx_sqal_alerts_device; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sqal_alerts_device ON public.sqal_alerts USING btree (device_id);


--
-- Name: idx_sqal_alerts_lot; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sqal_alerts_lot ON public.sqal_alerts USING btree (lot_id) WHERE (lot_id IS NOT NULL);


--
-- Name: idx_sqal_alerts_sample; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sqal_alerts_sample ON public.sqal_alerts USING btree (sample_id);


--
-- Name: idx_sqal_alerts_severity; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sqal_alerts_severity ON public.sqal_alerts USING btree (severity);


--
-- Name: idx_sqal_alerts_type; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sqal_alerts_type ON public.sqal_alerts USING btree (alert_type);


--
-- Name: idx_sqal_devices_site; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sqal_devices_site ON public.sqal_devices USING btree (site_code);


--
-- Name: idx_sqal_devices_status; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sqal_devices_status ON public.sqal_devices USING btree (status);


--
-- Name: idx_sqal_ml_models_status; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sqal_ml_models_status ON public.sqal_ml_models USING btree (status, is_production);


--
-- Name: idx_sqal_ml_models_type; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sqal_ml_models_type ON public.sqal_ml_models USING btree (model_type);


--
-- Name: idx_sqal_pending_date; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sqal_pending_date ON public.sqal_pending_lots USING btree (date_abattage DESC);


--
-- Name: idx_sqal_pending_site; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sqal_pending_site ON public.sqal_pending_lots USING btree (site);


--
-- Name: idx_sqal_pending_status; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sqal_pending_status ON public.sqal_pending_lots USING btree (status);


--
-- Name: idx_sqal_samples_device; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sqal_samples_device ON public.sqal_sensor_samples USING btree (device_id, "time" DESC);


--
-- Name: idx_sqal_samples_grade; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sqal_samples_grade ON public.sqal_sensor_samples USING btree (fusion_final_grade);


--
-- Name: idx_sqal_samples_lot; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sqal_samples_lot ON public.sqal_sensor_samples USING btree (lot_id) WHERE (lot_id IS NOT NULL);


--
-- Name: idx_sqal_samples_lot_poids; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sqal_samples_lot_poids ON public.sqal_sensor_samples USING btree (lot_id, poids_foie_estime_g) WHERE ((lot_id IS NOT NULL) AND (poids_foie_estime_g IS NOT NULL));


--
-- Name: INDEX idx_sqal_samples_lot_poids; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON INDEX public.idx_sqal_samples_lot_poids IS 'Index pour requêtes de production: agrégation poids par lot';


--
-- Name: idx_sqal_samples_sample_id; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sqal_samples_sample_id ON public.sqal_sensor_samples USING btree (sample_id);


--
-- Name: idx_sqal_samples_score; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_sqal_samples_score ON public.sqal_sensor_samples USING btree (fusion_final_score);


--
-- Name: idx_stats_dates; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_stats_dates ON public.statistiques_globales USING btree (date_debut, date_fin);


--
-- Name: idx_stats_lots_id; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE UNIQUE INDEX idx_stats_lots_id ON public.stats_lots USING btree (lot_id);


--
-- Name: idx_stats_lots_statut; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_stats_lots_statut ON public.stats_lots USING btree (statut);


--
-- Name: idx_stats_site_periode; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX idx_stats_site_periode ON public.statistiques_globales USING btree (site_code, periode);


--
-- Name: sqal_alerts_time_idx; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX sqal_alerts_time_idx ON public.sqal_alerts USING btree ("time" DESC);


--
-- Name: sqal_sensor_samples_time_idx; Type: INDEX; Schema: public; Owner: gaveurs_admin
--

CREATE INDEX sqal_sensor_samples_time_idx ON public.sqal_sensor_samples USING btree ("time" DESC);


--
-- Name: gavage_data_insert gavage_insert_to_lots; Type: RULE; Schema: public; Owner: gaveurs_admin
--

CREATE RULE gavage_insert_to_lots AS
    ON INSERT TO public.gavage_data_insert DO INSTEAD  INSERT INTO public.gavage_data_lots ("time", lot_gavage_id, jour_gavage, repas, dose_moyenne, dose_theorique, poids_moyen_lot, nb_canards_vivants, temperature_stabule, humidite_stabule)  SELECT new."time",
            new.lot_mais_id,
            COALESCE(( SELECT lots_gavage.jour_actuel
                   FROM public.lots_gavage
                  WHERE (lots_gavage.id = new.lot_mais_id)), 1) AS "coalesce",
                CASE
                    WHEN ((new.dose_matin > (0)::numeric) AND (new.dose_soir = (0)::numeric)) THEN 'matin'::text
                    WHEN ((new.dose_soir > (0)::numeric) AND (new.dose_matin = (0)::numeric)) THEN 'soir'::text
                    ELSE 'matin'::text
                END AS "case",
                CASE
                    WHEN (new.dose_matin > (0)::numeric) THEN new.dose_matin
                    ELSE new.dose_soir
                END AS dose_soir,
                CASE
                    WHEN (new.dose_matin > (0)::numeric) THEN new.dose_theorique_matin
                    ELSE new.dose_theorique_soir
                END AS dose_theorique_soir,
            new.poids_actuel,
            ( SELECT (lots_gavage.nb_canards_initial - COALESCE(lots_gavage.nb_morts, 0))
                   FROM public.lots_gavage
                  WHERE (lots_gavage.id = new.lot_mais_id)),
            new.temperature_stabule,
            new.humidite_stabule
          WHERE (new.canard_id IS NULL) ON CONFLICT("time", lot_gavage_id, repas) DO NOTHING;


--
-- Name: _hyper_5_2_chunk trigger_auto_canard; Type: TRIGGER; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TRIGGER trigger_auto_canard BEFORE INSERT ON _timescaledb_internal._hyper_5_2_chunk FOR EACH ROW WHEN ((new.canard_id IS NULL)) EXECUTE FUNCTION public.auto_assign_generic_canard();


--
-- Name: _hyper_5_3_chunk trigger_auto_canard; Type: TRIGGER; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TRIGGER trigger_auto_canard BEFORE INSERT ON _timescaledb_internal._hyper_5_3_chunk FOR EACH ROW WHEN ((new.canard_id IS NULL)) EXECUTE FUNCTION public.auto_assign_generic_canard();


--
-- Name: _hyper_16_27_chunk trigger_calculate_itm_from_sqal; Type: TRIGGER; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TRIGGER trigger_calculate_itm_from_sqal AFTER INSERT OR UPDATE ON _timescaledb_internal._hyper_16_27_chunk FOR EACH ROW WHEN (((new.lot_id IS NOT NULL) AND (new.poids_foie_estime_g IS NOT NULL))) EXECUTE FUNCTION public.calculate_itm_from_sqal();


--
-- Name: _hyper_22_22_chunk trigger_update_poids_lot; Type: TRIGGER; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TRIGGER trigger_update_poids_lot AFTER INSERT ON _timescaledb_internal._hyper_22_22_chunk FOR EACH ROW EXECUTE FUNCTION public.update_poids_moyen_lot();


--
-- Name: _hyper_22_26_chunk trigger_update_poids_lot; Type: TRIGGER; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TRIGGER trigger_update_poids_lot AFTER INSERT ON _timescaledb_internal._hyper_22_26_chunk FOR EACH ROW EXECUTE FUNCTION public.update_poids_moyen_lot();


--
-- Name: _hyper_22_6_chunk trigger_update_poids_lot; Type: TRIGGER; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TRIGGER trigger_update_poids_lot AFTER INSERT ON _timescaledb_internal._hyper_22_6_chunk FOR EACH ROW EXECUTE FUNCTION public.update_poids_moyen_lot();


--
-- Name: _hyper_22_7_chunk trigger_update_poids_lot; Type: TRIGGER; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

CREATE TRIGGER trigger_update_poids_lot AFTER INSERT ON _timescaledb_internal._hyper_22_7_chunk FOR EACH ROW EXECUTE FUNCTION public.update_poids_moyen_lot();


--
-- Name: gavage_data trigger_auto_canard; Type: TRIGGER; Schema: public; Owner: gaveurs_admin
--

CREATE TRIGGER trigger_auto_canard BEFORE INSERT ON public.gavage_data FOR EACH ROW WHEN ((new.canard_id IS NULL)) EXECUTE FUNCTION public.auto_assign_generic_canard();


--
-- Name: consumer_feedbacks trigger_auto_populate_ml_data; Type: TRIGGER; Schema: public; Owner: gaveurs_admin
--

CREATE TRIGGER trigger_auto_populate_ml_data AFTER INSERT ON public.consumer_feedbacks FOR EACH ROW EXECUTE FUNCTION public.auto_populate_ml_data();


--
-- Name: sqal_sensor_samples trigger_calculate_itm_from_sqal; Type: TRIGGER; Schema: public; Owner: gaveurs_admin
--

CREATE TRIGGER trigger_calculate_itm_from_sqal AFTER INSERT OR UPDATE ON public.sqal_sensor_samples FOR EACH ROW WHEN (((new.lot_id IS NOT NULL) AND (new.poids_foie_estime_g IS NOT NULL))) EXECUTE FUNCTION public.calculate_itm_from_sqal();


--
-- Name: TRIGGER trigger_calculate_itm_from_sqal ON sqal_sensor_samples; Type: COMMENT; Schema: public; Owner: gaveurs_admin
--

COMMENT ON TRIGGER trigger_calculate_itm_from_sqal ON public.sqal_sensor_samples IS 'Recalcule automatiquement ITM du lot quand nouvelles mesures SQAL avec poids arrivent';


--
-- Name: lots_gavage trigger_calculate_nb_morts; Type: TRIGGER; Schema: public; Owner: gaveurs_admin
--

CREATE TRIGGER trigger_calculate_nb_morts BEFORE INSERT OR UPDATE ON public.lots_gavage FOR EACH ROW EXECUTE FUNCTION public.calculate_nb_morts();


--
-- Name: lots_gavage trigger_extract_site_code; Type: TRIGGER; Schema: public; Owner: gaveurs_admin
--

CREATE TRIGGER trigger_extract_site_code BEFORE INSERT ON public.lots_gavage FOR EACH ROW WHEN ((new.site_code IS NULL)) EXECUTE FUNCTION public.extract_site_from_code_lot();


--
-- Name: lots_gavage trigger_lots_gavage_updated_at; Type: TRIGGER; Schema: public; Owner: gaveurs_admin
--

CREATE TRIGGER trigger_lots_gavage_updated_at BEFORE UPDATE ON public.lots_gavage FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: lots trigger_lots_updated_at; Type: TRIGGER; Schema: public; Owner: gaveurs_admin
--

CREATE TRIGGER trigger_lots_updated_at BEFORE UPDATE ON public.lots FOR EACH ROW EXECUTE FUNCTION public.update_lots_updated_at();


--
-- Name: sqal_pending_lots trigger_sqal_pending_updated_at; Type: TRIGGER; Schema: public; Owner: gaveurs_admin
--

CREATE TRIGGER trigger_sqal_pending_updated_at BEFORE UPDATE ON public.sqal_pending_lots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: gavage_lot_quotidien trigger_update_poids_lot; Type: TRIGGER; Schema: public; Owner: gaveurs_admin
--

CREATE TRIGGER trigger_update_poids_lot AFTER INSERT ON public.gavage_lot_quotidien FOR EACH ROW EXECUTE FUNCTION public.update_poids_moyen_lot();


--
-- Name: bug_comments update_bug_comments_updated_at; Type: TRIGGER; Schema: public; Owner: gaveurs_admin
--

CREATE TRIGGER update_bug_comments_updated_at BEFORE UPDATE ON public.bug_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bug_reports update_bug_reports_updated_at; Type: TRIGGER; Schema: public; Owner: gaveurs_admin
--

CREATE TRIGGER update_bug_reports_updated_at BEFORE UPDATE ON public.bug_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: canards update_canards_updated_at; Type: TRIGGER; Schema: public; Owner: gaveurs_admin
--

CREATE TRIGGER update_canards_updated_at BEFORE UPDATE ON public.canards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: gaveurs update_gaveurs_updated_at; Type: TRIGGER; Schema: public; Owner: gaveurs_admin
--

CREATE TRIGGER update_gaveurs_updated_at BEFORE UPDATE ON public.gaveurs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: _hyper_9_1_chunk 1_1_alertes_acquittee_par_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_9_1_chunk
    ADD CONSTRAINT "1_1_alertes_acquittee_par_fkey" FOREIGN KEY (acquittee_par) REFERENCES public.gaveurs(id);


--
-- Name: _hyper_9_1_chunk 1_2_alertes_canard_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_9_1_chunk
    ADD CONSTRAINT "1_2_alertes_canard_id_fkey" FOREIGN KEY (canard_id) REFERENCES public.canards(id);


--
-- Name: _hyper_24_219_chunk 219_614_gavage_data_lots_lot_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_24_219_chunk
    ADD CONSTRAINT "219_614_gavage_data_lots_lot_fkey" FOREIGN KEY (lot_gavage_id) REFERENCES public.lots_gavage(id) ON DELETE CASCADE;


--
-- Name: _hyper_24_220_chunk 220_616_gavage_data_lots_lot_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_24_220_chunk
    ADD CONSTRAINT "220_616_gavage_data_lots_lot_fkey" FOREIGN KEY (lot_gavage_id) REFERENCES public.lots_gavage(id) ON DELETE CASCADE;


--
-- Name: _hyper_22_22_chunk 22_42_gavage_lot_quotidien_lot_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_22_chunk
    ADD CONSTRAINT "22_42_gavage_lot_quotidien_lot_id_fkey" FOREIGN KEY (lot_id) REFERENCES public.lots(id) ON DELETE CASCADE;


--
-- Name: _hyper_1_24_chunk 24_44_doses_journalieres_lot_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_1_24_chunk
    ADD CONSTRAINT "24_44_doses_journalieres_lot_id_fkey" FOREIGN KEY (lot_id) REFERENCES public.lots_gavage(id) ON DELETE CASCADE;


--
-- Name: _hyper_1_25_chunk 25_46_doses_journalieres_lot_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_1_25_chunk
    ADD CONSTRAINT "25_46_doses_journalieres_lot_id_fkey" FOREIGN KEY (lot_id) REFERENCES public.lots_gavage(id) ON DELETE CASCADE;


--
-- Name: _hyper_22_26_chunk 26_48_gavage_lot_quotidien_lot_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_26_chunk
    ADD CONSTRAINT "26_48_gavage_lot_quotidien_lot_id_fkey" FOREIGN KEY (lot_id) REFERENCES public.lots(id) ON DELETE CASCADE;


--
-- Name: _hyper_16_27_chunk 27_50_sqal_sensor_samples_device_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_16_27_chunk
    ADD CONSTRAINT "27_50_sqal_sensor_samples_device_id_fkey" FOREIGN KEY (device_id) REFERENCES public.sqal_devices(device_id);


--
-- Name: _hyper_16_27_chunk 27_51_sqal_sensor_samples_lot_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_16_27_chunk
    ADD CONSTRAINT "27_51_sqal_sensor_samples_lot_id_fkey" FOREIGN KEY (lot_id) REFERENCES public.lots_gavage(id);


--
-- Name: _hyper_5_2_chunk 2_4_gavage_data_canard_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_5_2_chunk
    ADD CONSTRAINT "2_4_gavage_data_canard_id_fkey" FOREIGN KEY (canard_id) REFERENCES public.canards(id);


--
-- Name: _hyper_5_2_chunk 2_5_gavage_data_lot_mais_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_5_2_chunk
    ADD CONSTRAINT "2_5_gavage_data_lot_mais_id_fkey" FOREIGN KEY (lot_mais_id) REFERENCES public.lot_mais(id);


--
-- Name: _hyper_5_3_chunk 3_7_gavage_data_canard_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_5_3_chunk
    ADD CONSTRAINT "3_7_gavage_data_canard_id_fkey" FOREIGN KEY (canard_id) REFERENCES public.canards(id);


--
-- Name: _hyper_5_3_chunk 3_8_gavage_data_lot_mais_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_5_3_chunk
    ADD CONSTRAINT "3_8_gavage_data_lot_mais_id_fkey" FOREIGN KEY (lot_mais_id) REFERENCES public.lot_mais(id);


--
-- Name: _hyper_22_6_chunk 6_12_gavage_lot_quotidien_lot_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_6_chunk
    ADD CONSTRAINT "6_12_gavage_lot_quotidien_lot_id_fkey" FOREIGN KEY (lot_id) REFERENCES public.lots(id) ON DELETE CASCADE;


--
-- Name: _hyper_22_7_chunk 7_14_gavage_lot_quotidien_lot_id_fkey; Type: FK CONSTRAINT; Schema: _timescaledb_internal; Owner: gaveurs_admin
--

ALTER TABLE ONLY _timescaledb_internal._hyper_22_7_chunk
    ADD CONSTRAINT "7_14_gavage_lot_quotidien_lot_id_fkey" FOREIGN KEY (lot_id) REFERENCES public.lots(id) ON DELETE CASCADE;


--
-- Name: alertes alertes_acquittee_par_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.alertes
    ADD CONSTRAINT alertes_acquittee_par_fkey FOREIGN KEY (acquittee_par) REFERENCES public.gaveurs(id);


--
-- Name: alertes alertes_canard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.alertes
    ADD CONSTRAINT alertes_canard_id_fkey FOREIGN KEY (canard_id) REFERENCES public.canards(id);


--
-- Name: alertes_euralis alertes_euralis_gaveur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.alertes_euralis
    ADD CONSTRAINT alertes_euralis_gaveur_id_fkey FOREIGN KEY (gaveur_id) REFERENCES public.gaveurs_euralis(id);


--
-- Name: alertes_euralis alertes_euralis_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.alertes_euralis
    ADD CONSTRAINT alertes_euralis_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.lots_gavage(id) ON DELETE CASCADE;


--
-- Name: alertes_euralis alertes_euralis_site_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.alertes_euralis
    ADD CONSTRAINT alertes_euralis_site_code_fkey FOREIGN KEY (site_code) REFERENCES public.sites_euralis(code);


--
-- Name: anomalies_detectees anomalies_detectees_gaveur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.anomalies_detectees
    ADD CONSTRAINT anomalies_detectees_gaveur_id_fkey FOREIGN KEY (gaveur_id) REFERENCES public.gaveurs_euralis(id);


--
-- Name: anomalies_detectees anomalies_detectees_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.anomalies_detectees
    ADD CONSTRAINT anomalies_detectees_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.lots_gavage(id);


--
-- Name: anomalies_detectees anomalies_detectees_site_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.anomalies_detectees
    ADD CONSTRAINT anomalies_detectees_site_code_fkey FOREIGN KEY (site_code) REFERENCES public.sites_euralis(code);


--
-- Name: blockchain blockchain_abattoir_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.blockchain
    ADD CONSTRAINT blockchain_abattoir_id_fkey FOREIGN KEY (abattoir_id) REFERENCES public.abattoirs(id);


--
-- Name: blockchain blockchain_gaveur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.blockchain
    ADD CONSTRAINT blockchain_gaveur_id_fkey FOREIGN KEY (gaveur_id) REFERENCES public.gaveurs(id);


--
-- Name: bug_comments bug_comments_bug_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.bug_comments
    ADD CONSTRAINT bug_comments_bug_report_id_fkey FOREIGN KEY (bug_report_id) REFERENCES public.bug_reports(id) ON DELETE CASCADE;


--
-- Name: canards canards_gaveur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.canards
    ADD CONSTRAINT canards_gaveur_id_fkey FOREIGN KEY (gaveur_id) REFERENCES public.gaveurs(id);


--
-- Name: canards canards_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.canards
    ADD CONSTRAINT canards_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.lots(id) ON DELETE SET NULL;


--
-- Name: consumer_feedback_ml_data consumer_feedback_ml_data_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.consumer_feedback_ml_data
    ADD CONSTRAINT consumer_feedback_ml_data_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.lots_gavage(id);


--
-- Name: consumer_feedbacks consumer_feedbacks_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.consumer_feedbacks
    ADD CONSTRAINT consumer_feedbacks_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.consumer_products(product_id);


--
-- Name: consumer_products consumer_products_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.consumer_products
    ADD CONSTRAINT consumer_products_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.lots_gavage(id);


--
-- Name: consumer_products consumer_products_site_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.consumer_products
    ADD CONSTRAINT consumer_products_site_code_fkey FOREIGN KEY (site_code) REFERENCES public.sites_euralis(code);


--
-- Name: corrections_doses corrections_doses_canard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.corrections_doses
    ADD CONSTRAINT corrections_doses_canard_id_fkey FOREIGN KEY (canard_id) REFERENCES public.canards(id);


--
-- Name: doses_journalieres doses_journalieres_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.doses_journalieres
    ADD CONSTRAINT doses_journalieres_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.lots_gavage(id) ON DELETE CASCADE;


--
-- Name: consumer_feedback_ml_data fk_feedback; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.consumer_feedback_ml_data
    ADD CONSTRAINT fk_feedback FOREIGN KEY (lot_id) REFERENCES public.lots_gavage(id);


--
-- Name: lot_events fk_lot_events_lot; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.lot_events
    ADD CONSTRAINT fk_lot_events_lot FOREIGN KEY (lot_id) REFERENCES public.lots_registry(lot_id) ON DELETE CASCADE;


--
-- Name: sqal_pending_lots fk_sqal_pending_lots_code; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.sqal_pending_lots
    ADD CONSTRAINT fk_sqal_pending_lots_code FOREIGN KEY (code_lot) REFERENCES public.lots_gavage(code_lot) ON DELETE SET NULL;


--
-- Name: formules_pysr formules_pysr_site_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.formules_pysr
    ADD CONSTRAINT formules_pysr_site_code_fkey FOREIGN KEY (site_code) REFERENCES public.sites_euralis(code);


--
-- Name: gavage_data gavage_data_canard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.gavage_data
    ADD CONSTRAINT gavage_data_canard_id_fkey FOREIGN KEY (canard_id) REFERENCES public.canards(id);


--
-- Name: gavage_data gavage_data_lot_mais_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.gavage_data
    ADD CONSTRAINT gavage_data_lot_mais_id_fkey FOREIGN KEY (lot_mais_id) REFERENCES public.lot_mais(id);


--
-- Name: gavage_data_lots gavage_data_lots_lot_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.gavage_data_lots
    ADD CONSTRAINT gavage_data_lots_lot_fkey FOREIGN KEY (lot_gavage_id) REFERENCES public.lots_gavage(id) ON DELETE CASCADE;


--
-- Name: gavage_lot_quotidien gavage_lot_quotidien_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.gavage_lot_quotidien
    ADD CONSTRAINT gavage_lot_quotidien_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.lots(id) ON DELETE CASCADE;


--
-- Name: gaveurs_clusters gaveurs_clusters_gaveur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.gaveurs_clusters
    ADD CONSTRAINT gaveurs_clusters_gaveur_id_fkey FOREIGN KEY (gaveur_id) REFERENCES public.gaveurs_euralis(id) ON DELETE CASCADE;


--
-- Name: gaveurs_euralis gaveurs_euralis_site_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.gaveurs_euralis
    ADD CONSTRAINT gaveurs_euralis_site_code_fkey FOREIGN KEY (site_code) REFERENCES public.sites_euralis(code);


--
-- Name: lot_events lot_events_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.lot_events
    ADD CONSTRAINT lot_events_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.lots_registry(lot_id) ON DELETE CASCADE;


--
-- Name: lots_gavage lots_gavage_gaveur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.lots_gavage
    ADD CONSTRAINT lots_gavage_gaveur_id_fkey FOREIGN KEY (gaveur_id) REFERENCES public.gaveurs_euralis(id);


--
-- Name: lots_gavage lots_gavage_site_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.lots_gavage
    ADD CONSTRAINT lots_gavage_site_code_fkey FOREIGN KEY (site_code) REFERENCES public.sites_euralis(code);


--
-- Name: lots lots_gaveur_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.lots
    ADD CONSTRAINT lots_gaveur_id_fkey FOREIGN KEY (gaveur_id) REFERENCES public.gaveurs(id) ON DELETE CASCADE;


--
-- Name: lots lots_lot_mais_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.lots
    ADD CONSTRAINT lots_lot_mais_id_fkey FOREIGN KEY (lot_mais_id) REFERENCES public.lot_mais(id);


--
-- Name: mortalite mortalite_canard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.mortalite
    ADD CONSTRAINT mortalite_canard_id_fkey FOREIGN KEY (canard_id) REFERENCES public.canards(id);


--
-- Name: planning_abattages planning_abattages_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.planning_abattages
    ADD CONSTRAINT planning_abattages_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.lots_gavage(id) ON DELETE CASCADE;


--
-- Name: planning_abattages planning_abattages_site_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.planning_abattages
    ADD CONSTRAINT planning_abattages_site_code_fkey FOREIGN KEY (site_code) REFERENCES public.sites_euralis(code);


--
-- Name: predictions_courbes predictions_courbes_canard_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.predictions_courbes
    ADD CONSTRAINT predictions_courbes_canard_id_fkey FOREIGN KEY (canard_id) REFERENCES public.canards(id);


--
-- Name: previsions_production previsions_production_site_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.previsions_production
    ADD CONSTRAINT previsions_production_site_code_fkey FOREIGN KEY (site_code) REFERENCES public.sites_euralis(code);


--
-- Name: sqal_alerts sqal_alerts_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.sqal_alerts
    ADD CONSTRAINT sqal_alerts_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.sqal_devices(device_id);


--
-- Name: sqal_alerts sqal_alerts_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.sqal_alerts
    ADD CONSTRAINT sqal_alerts_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.lots_gavage(id);


--
-- Name: sqal_devices sqal_devices_site_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.sqal_devices
    ADD CONSTRAINT sqal_devices_site_code_fkey FOREIGN KEY (site_code) REFERENCES public.sites_euralis(code);


--
-- Name: sqal_sensor_samples sqal_sensor_samples_device_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.sqal_sensor_samples
    ADD CONSTRAINT sqal_sensor_samples_device_id_fkey FOREIGN KEY (device_id) REFERENCES public.sqal_devices(device_id);


--
-- Name: sqal_sensor_samples sqal_sensor_samples_lot_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.sqal_sensor_samples
    ADD CONSTRAINT sqal_sensor_samples_lot_id_fkey FOREIGN KEY (lot_id) REFERENCES public.lots_gavage(id);


--
-- Name: statistiques_globales statistiques_globales_site_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: gaveurs_admin
--

ALTER TABLE ONLY public.statistiques_globales
    ADD CONSTRAINT statistiques_globales_site_code_fkey FOREIGN KEY (site_code) REFERENCES public.sites_euralis(code);


--
-- Name: consumer_product_stats; Type: MATERIALIZED VIEW DATA; Schema: public; Owner: gaveurs_admin
--

REFRESH MATERIALIZED VIEW public.consumer_product_stats;


--
-- Name: performances_sites; Type: MATERIALIZED VIEW DATA; Schema: public; Owner: gaveurs_admin
--

REFRESH MATERIALIZED VIEW public.performances_sites;


--
-- Name: stats_lots; Type: MATERIALIZED VIEW DATA; Schema: public; Owner: gaveurs_admin
--

REFRESH MATERIALIZED VIEW public.stats_lots;


--
-- PostgreSQL database dump complete
--

