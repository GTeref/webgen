
// ***** Get intersection of barcodes from selected pie sectors (below) *****

getBarcodesFromSelectedPieSectors = async function(selectedTumorTypes) {
  // a "field" is either a gene name or a clinical feature
  let selectedCategoricalFields = Object.keys(selectedCategoricalFeatures);
  let concatFilteredBarcodes = [];
  let cacheMu = await getCacheMU(); // Instantiate caching interface for mutation data
  let cacheBar = await getCacheBAR(); // Instantiate caching interface for barcode data
  let cacheClin = await getCacheCLIN(); // Instantiate caching interface for clinical data
  let barcodesByCohort = await cacheBar.fetchWrapperBAR(selectedTumorTypes); // Get all barcodes for the selected cohorts
  let clinicalData = await cacheClin.fetchWrapperCLIN(selectedTumorTypes, barcodesByCohort); // Fetch clinical data for cohorts of interest
  clinicalData = clinicalData.map(obj => obj.clinical_data); // Extract mutation_data property for each cohort
  clinicalData = clinicalData.flat(); // Use flat() to make patients' clinical data a 1-D array
  // LOOP THRU ALL CLICKED FIELDS
  for(let i = 0; i < selectedCategoricalFields.length; i++) {
    let currentField = selectedCategoricalFields[i];
    // if current selected sector belongs to a gene...
    if(currentField[i].toUpperCase() == currentField[i]) {
      let currentGene = currentField;
      let mutationDataForThisGene = await cacheMu.fetchWrapperMU(selectedTumorTypes, [currentGene]); // Fetch mutation data for currentGene
      let clickedMutations = selectedCategoricalFeatures[currentGene]; // Get array of selected mutations
      concatFilteredBarcodes[currentGene] = []; // Initialize to empty array to use push()
      //If mutations have been selected, then append the relevant barcodes
      if(clickedMutations.length > 0) {
        // Iterate over mutation data for a specific gene to get patients with mutation types of interest
        for(let index = 0; index < mutationDataForThisGene.length; index++) {
          // If mutation_label property for current patient is in array of selected mutation types, then append to barcodes array
          if(clickedMutations.includes(mutationDataForThisGene[index].mutation_label))
            concatFilteredBarcodes[currentGene].push(mutationDataForThisGene[index]["tcga_participant_barcode"]); // Append patient barcode to concatFilteredBarcodes
        }
      }
      //If no mutations have been selected, then we will append all the barcodes to the array
      else {
        for(let index = 0; index < mutationDataForThisGene.length; index++) {
          concatFilteredBarcodes[currentGene].push(mutationDataForThisGene[index]["tcga_participant_barcode"]); // Apend patient barcode to concatFilteredBarcodes
        } 
      }

    } else {

      let currentClinicalFeature = currentField;
      let filteredClinicalData = [];
      let uniqueBarcodes;

      let clickedClinicalValues = selectedCategoricalFeatures[currentClinicalFeature];

      for(let j = 0; j < clickedClinicalValues.length; j++) {

        let currentClinicalValue = clickedClinicalValues[j];

        filteredClinicalData = clinicalData.filter(person => (person[currentClinicalFeature] == currentClinicalValue))

        let onlyBarcodes = filteredClinicalData.map(x => x.tcga_participant_barcode);

        function onlyUnique(value, index, self) {
          return self.indexOf(value) === index;
        }
        uniqueBarcodes = onlyBarcodes.filter(onlyUnique);

        if(concatFilteredBarcodes['' + currentClinicalFeature] == undefined)
          concatFilteredBarcodes['' + currentClinicalFeature] = uniqueBarcodes;
        else
          concatFilteredBarcodes['' + currentClinicalFeature] = concatFilteredBarcodes['' + currentClinicalFeature].concat(uniqueBarcodes);
      }
    }
  }
  // loop through all range data
  for(let continuousFeature of Object.keys(selectedContinuousFeatures)) {
    let rangeValue = selectedContinuousFeatures[continuousFeature]; // Get range of data to filter clinicalData by
    filteredRangeData = clinicalData.filter(person => (person[continuousFeature] >= rangeValue[0] && person[continuousFeature] <= rangeValue[1]))

    let onlyBarcodes = filteredRangeData.map(x => x.tcga_participant_barcode);

    function onlyUnique(value, index, self) {
      return self.indexOf(value) === index;
    }
    uniqueBarcodes = onlyBarcodes.filter(onlyUnique);

    if(concatFilteredBarcodes['' + continuousFeature] == undefined)
      concatFilteredBarcodes['' + continuousFeature] = uniqueBarcodes;
    else
      concatFilteredBarcodes['' + continuousFeature] = concatFilteredBarcodes['' + continuousFeature].concat(uniqueBarcodes);
  }


  // Get intersection of barcodes from selected pie sectors
  let clicked_gene_mutation = Object.keys(concatFilteredBarcodes);
  let intersectedBarcodes;

  // If user clicked 0 or 1 gene/mutation combos, simply use these barcodes
  if(clicked_gene_mutation.length <= 1) {
    let currentGene = clicked_gene_mutation[0];
    intersectedBarcodes = concatFilteredBarcodes[currentGene]; // barcode(s) for selected gene mutation combo in given cancer type

  // If user clicked >1 gene/mutation combos, compute intersection
  } else {
    for(let i = 0; i < clicked_gene_mutation.length - 1; i++) {
      let currentGene = clicked_gene_mutation[i];
      let nextGene = clicked_gene_mutation[i + 1];
      let barcodesForCurrentGene = concatFilteredBarcodes[currentGene]; // barcode(s) for selected gene mutation combo in given cancer type
      let barcodesForNextGene = concatFilteredBarcodes[nextGene];
      intersectedBarcodes = barcodesForCurrentGene.filter(x => barcodesForNextGene.includes(x));
    }
  }
  return intersectedBarcodes
}

/**
 * Get patient barcodes from selected histogram expression ranges
 * 
 * @param {Array} selectedTumorTypes - Array of selected tumor types
 * @returns {Array} Array of patient barcodes that match expression range criteria
 */
async function getBarcodesFromSelectedHistogramRange(selectedTumorTypes) {
  let histogramFilteredBarcodes = [];
  
  // Get all genes that have expression range filters
  console.log(selectedContinuousFeatures)
  let genesWithExpressionFilters = Object.keys(selectedContinuousFeatures).filter(key => {
      // Check if this key represents a gene (starts with uppercase) and has a range
      return key[0] === key[0].toUpperCase() && 
             selectedContinuousFeatures[key] && 
             selectedContinuousFeatures[key].length >= 2;
  });
  
  console.log('Genes with expression filters:', genesWithExpressionFilters);
  
  if (genesWithExpressionFilters.length === 0) {
      return []; // No expression filters applied
  }
  
  // Fetch gene expression cache
  let cacheGe = await getCacheGE();
  
  // Process each gene with expression filters
  for (let gene of genesWithExpressionFilters) {
      let rangeValue = selectedContinuousFeatures[gene];
      let minExpression = rangeValue[0];
      let maxExpression = rangeValue[1];
      
      console.log(`Processing expression filter for ${gene}: ${minExpression} to ${maxExpression}`);
      
      // Fetch gene expression data for this gene
      let geneExpressionData = await cacheGe.fetchWrapperGE(selectedTumorTypes, [gene]);
      
      // Filter by expression range and tumor samples only
      let filteredExpressionData = geneExpressionData.filter(record => {
          return record.sample_type === "TP" && 
                 record.expression_log2 !== null &&
                 record.expression_log2 !== undefined &&
                 !isNaN(record.expression_log2) &&
                 record.expression_log2 >= minExpression && 
                 record.expression_log2 <= maxExpression;
      });
      
      // Extract unique barcodes for this gene
      let barcodesForThisGene = filteredExpressionData.map(record => record.tcga_participant_barcode);
      
      // Remove duplicates
      function onlyUnique(value, index, self) {
          return self.indexOf(value) === index;
      }
      barcodesForThisGene = barcodesForThisGene.filter(onlyUnique);
      
      console.log(`Found ${barcodesForThisGene.length} patients for ${gene} expression filter`);
      
      // Store barcodes for this gene
      histogramFilteredBarcodes.push({
          gene: gene,
          range: [minExpression, maxExpression],
          barcodes: barcodesForThisGene
      });
  }
  
  // If only one gene filter, return those barcodes
  if (histogramFilteredBarcodes.length === 1) {
      return histogramFilteredBarcodes[0].barcodes;
  }
  
  // If multiple gene filters, compute intersection
  if (histogramFilteredBarcodes.length > 1) {
      let intersectedBarcodes = histogramFilteredBarcodes[0].barcodes;
      
      for (let i = 1; i < histogramFilteredBarcodes.length; i++) {
          intersectedBarcodes = intersectedBarcodes.filter(barcode => 
              histogramFilteredBarcodes[i].barcodes.includes(barcode)
          );
      }
      
      console.log(`Intersection of ${histogramFilteredBarcodes.length} expression filters: ${intersectedBarcodes.length} patients`);
      return intersectedBarcodes;
  }
  
  return [];
}
