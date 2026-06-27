# CargoLink — Plateforme logistique Europe ↔ Maroc (MVP)

## Problème / Objectif
Plateforme MVP de gestion d'envois de colis entre l'Europe et le Maroc, réunissant 3 espaces dans une seule app web responsive :
1. Front Office (Client), 2. Back Office (Agent/Admin), 3. Scanner QR mobile (Chauffeur/agent terrain).

## Stack
- Frontend: React 19 + Tailwind + shadcn/ui + Phosphor icons + html5-qrcode. Bilingue FR/AR (RTL).
- Backend: FastAPI + Motor (MongoDB). Auth JWT (cookies httpOnly) + bcrypt.
- QR: génération côté backend (lib python `qrcode`, data URL PNG), scan via html5-qrcode.

## Personas
- Client: crée/suit ses envois, estime les coûts.
- Agent/Chef d'agence/Admin: gère tous les envois, clients, met à jour les statuts, scanne.

## Modèle de données
- users {email, password_hash, first_name, last_name, phone, address, role(client|agent|chef_agence|admin)}
- shipments {tracking_number(CL...), qr_code, client_id, sender, recipient, parcel, origin_country, pickup_mode, pickup_slot, estimate, status, history[], created_at}
- Statuts: demande_creee → en_attente_collecte → recu_agence → en_transit → en_douane → livre

## Implémenté (2026-06-27)
- Auth JWT (register/login/logout/me/profile), seed admin + agent, RBAC staff.
- Front Office: dashboard client, création demande d'envoi (expéditeur pré-rempli, destinataire, colis, mode collecte agence/domicile + créneau), QR généré, fiche colis avec QR téléchargeable, suivi public /track, estimateur public /estimate (€ + MAD + fourchette douane indicative).
- Back Office: dashboard stats + alertes (colis en retard >7j), liste envois (filtre statut + recherche + maj statut + QR), gestion clients + fiche détaillée (dialog).
- Scanner: caméra QR + saisie manuelle, infos colis, boutons d'action de statut, synchro immédiate (polling au chargement des pages).
- Bilingue FR/AR avec bascule + RTL.

## Comptes de test
- admin@cargolink.ma / admin123 ; agent@cargolink.ma / agent123 ; client à créer via /register.

## Backlog / Next
- P1: endpoint /api/auth/refresh (cookie refresh non exploité, session expire à 12h), brute-force lockout login.
- P1: validation Literal pickup_mode, pagination listes.
- P2: temps réel WebSocket (actuellement polling au chargement), email de confirmation (volontairement hors scope MVP), filtres date/destination supplémentaires Back Office.
- P2: gestion de profil client (édition) côté UI (endpoint /auth/profile déjà prêt).
