/**
 * Migration script to backfill hospital field for existing data
 * 
 * This script:
 * 1. Finds all DicomStudy records without hospital field
 * 2. Determines hospital based on uploadedBy user
 * 3. Sets hospital field for DicomStudy records
 * 4. Does the same for WordFile records
 * 5. Creates separate Patient records for each hospital
 * 
 * Run this script manually after deploying the schema changes:
 * node backend/scripts/migrateDataToHospital.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const DicomStudy = require('../models/DicomStudy');
const WordFile = require('../models/WordFile');
const Patient = require('../models/Patient');
const User = require('../models/User');
const Hospital = require('../models/Hospital');
const HospitalMember = require('../models/HospitalMember');

async function migrateDataToHospital() {
  try {
    console.log('Connecting to database...');
    await connectDB();
    console.log('Connected to database');
    
    let migratedStudies = 0;
    let migratedWordFiles = 0;
    let orphanedStudies = 0;
    let orphanedWordFiles = 0;
    let createdPatients = 0;
    
    // Helper function to get user's hospital
    async function getUserHospital(user) {
      if (!user) return null;
      
      if (user.role === 'admin') {
        return await Hospital.findOne({ admin: user._id });
      } else if (user.role === 'doctor') {
        const membership = await HospitalMember.findOne({ 
          user: user._id, 
          status: 'accepted' 
        }).populate('hospital');
        return membership ? membership.hospital : null;
      }
      
      return null;
    }
    
    // Migrate DicomStudy records
    console.log('\n=== Migrating DICOM Studies ===');
    const studiesWithoutHospital = await DicomStudy.find({ 
      $or: [
        { hospital: { $exists: false } },
        { hospital: null }
      ]
    });
    
    console.log(`Found ${studiesWithoutHospital.length} DICOM studies without hospital`);
    
    for (const study of studiesWithoutHospital) {
      if (study.uploadedBy) {
        const user = await User.findById(study.uploadedBy);
        if (user) {
          const hospital = await getUserHospital(user);
          if (hospital) {
            study.hospital = hospital._id;
            await study.save();
            migratedStudies++;
            if (migratedStudies % 100 === 0) {
              console.log(`Migrated ${migratedStudies} studies...`);
            }
          } else {
            orphanedStudies++;
            console.log(`Warning: Study ${study._id} has no hospital (user ${user._id} has no hospital)`);
          }
        } else {
          orphanedStudies++;
          console.log(`Warning: Study ${study._id} has invalid uploadedBy user`);
        }
      } else {
        orphanedStudies++;
        console.log(`Warning: Study ${study._id} has no uploadedBy field`);
      }
    }
    
    console.log(`Migrated ${migratedStudies} DICOM studies`);
    console.log(`Orphaned ${orphanedStudies} DICOM studies (no hospital found)`);
    
    // Migrate WordFile records
    console.log('\n=== Migrating Word Files ===');
    const wordFilesWithoutHospital = await WordFile.find({ 
      $or: [
        { hospital: { $exists: false } },
        { hospital: null }
      ]
    });
    
    console.log(`Found ${wordFilesWithoutHospital.length} Word files without hospital`);
    
    for (const wordFile of wordFilesWithoutHospital) {
      if (wordFile.uploadedBy) {
        const user = await User.findById(wordFile.uploadedBy);
        if (user) {
          const hospital = await getUserHospital(user);
          if (hospital) {
            wordFile.hospital = hospital._id;
            await wordFile.save();
            migratedWordFiles++;
            if (migratedWordFiles % 100 === 0) {
              console.log(`Migrated ${migratedWordFiles} word files...`);
            }
          } else {
            orphanedWordFiles++;
            console.log(`Warning: WordFile ${wordFile._id} has no hospital (user ${user._id} has no hospital)`);
          }
        } else {
          orphanedWordFiles++;
          console.log(`Warning: WordFile ${wordFile._id} has invalid uploadedBy user`);
        }
      } else {
        orphanedWordFiles++;
        console.log(`Warning: WordFile ${wordFile._id} has no uploadedBy field`);
      }
    }
    
    console.log(`Migrated ${migratedWordFiles} Word files`);
    console.log(`Orphaned ${orphanedWordFiles} Word files (no hospital found)`);
    
    // Migrate Patient records
    console.log('\n=== Migrating Patients ===');
    
    // Get all existing patients (without hospital field)
    const patientsWithoutHospital = await Patient.find({ 
      $or: [
        { hospital: { $exists: false } },
        { hospital: null }
      ]
    });
    
    console.log(`Found ${patientsWithoutHospital.length} patients without hospital`);
    
    // For each patient, find all studies and files, group by hospital, create new patient records
    for (const oldPatient of patientsWithoutHospital) {
      // Find all studies for this patientId
      const studies = await DicomStudy.find({ patientId: oldPatient.patientId });
      
      // Find all word files for this patientId
      const wordFiles = await WordFile.find({ patientId: oldPatient.patientId });
      
      // Group by hospital
      const hospitalsMap = new Map();
      
      for (const study of studies) {
        if (study.hospital) {
          const hospitalId = study.hospital.toString();
          if (!hospitalsMap.has(hospitalId)) {
            hospitalsMap.set(hospitalId, { hospital: study.hospital, studies: [], wordFiles: [] });
          }
          hospitalsMap.get(hospitalId).studies.push(study);
        }
      }
      
      for (const wordFile of wordFiles) {
        if (wordFile.hospital) {
          const hospitalId = wordFile.hospital.toString();
          if (!hospitalsMap.has(hospitalId)) {
            hospitalsMap.set(hospitalId, { hospital: wordFile.hospital, studies: [], wordFiles: [] });
          }
          hospitalsMap.get(hospitalId).wordFiles.push(wordFile);
        }
      }
      
      // Create new patient record for each hospital
      for (const [hospitalId, data] of hospitalsMap) {
        const dicomCount = data.studies.length;
        const wordFileCount = data.wordFiles.length;
        
        // Check if patient already exists for this hospital
        let patient = await Patient.findOne({ 
          patientId: oldPatient.patientId, 
          hospital: data.hospital 
        });
        
        if (!patient) {
          patient = await Patient.create({
            patientId: oldPatient.patientId,
            hospital: data.hospital,
            patientName: oldPatient.patientName,
            patientBirthDate: oldPatient.patientBirthDate,
            patientSex: oldPatient.patientSex,
            otherPatientIds: oldPatient.otherPatientIds,
            dicomStudyCount: dicomCount,
            wordFileCount: wordFileCount
          });
          createdPatients++;
        } else {
          // Update counts
          patient.dicomStudyCount = dicomCount;
          patient.wordFileCount = wordFileCount;
          await patient.save();
        }
      }
      
      // Delete old patient record (no hospital)
      await Patient.findByIdAndDelete(oldPatient._id);
    }
    
    console.log(`Created/updated ${createdPatients} patient records`);
    console.log(`Deleted ${patientsWithoutHospital.length} old patient records`);
    
    console.log('\n=== Migration Summary ===');
    console.log(`DICOM Studies: ${migratedStudies} migrated, ${orphanedStudies} orphaned`);
    console.log(`Word Files: ${migratedWordFiles} migrated, ${orphanedWordFiles} orphaned`);
    console.log(`Patients: ${createdPatients} created/updated`);
    console.log('\nMigration completed!');
    
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

// Run migration
migrateDataToHospital();
