/**
 * Extracts survival time information from clinical data
 * @param {Array} clinicalData An array of JSON objects for each patient's clinical data
 * @returns An array of JSONs containing the number of lost patients at a corresponding timestamp
 */
const format_survival_date = function(clinicalData) {
    let deathCounts = {}
    //For each participant, construct a new feature for their survival status
    for(let index = 0; index < clinicalData.length; index++) {
      let time;
      if (clinicalData[index].days_to_death != "NA") {
        time = clinicalData[index].days_to_death
      }
      else if(clinicalData[index].days_to_last_followup != "NA") {
        time = clinicalData[index].days_to_last_followup
      }
      else {
        time = clinicalData[index].days_to_last_known_alive
      }
      deathCounts[time] = deathCounts[time] ? deathCounts[time] + 1 : 1
    }
    return deathCounts
}

/**
 * Takes the formatted survival data and computes the survival rates
 * @param {Array} data An array of JSON objects with the normalized survival data
 * @returns A JSON whose values are arrays of JSONs providing the information necessary to plot individual survival curves
 */
const calculate_survival_values = function(data){
  //Get unique times in survival data
  let uniqueDeathTimes = Object.keys(data);
  let patientCounts = Object.values(data)
  let initialValue = 0
  let patientsAtRisk = patientCounts.reduce((accumulator, currentValue) => accumulator + currentValue, initialValue);
  //Compute survival probabilities
  let survivalProbsTable = uniqueDeathTimes.map(time => {
    //Compute number of deaths at time t
    let deaths = data[time]
    //Compute number of individuals at risk
    patientsAtRisk = patientsAtRisk - deaths
    //Compute survival probability at each time t
    let survivalProb = 1 - (deaths/patientsAtRisk);
    return {"time": Number.parseInt(time), "deaths": deaths, "patients_at_risk": patientsAtRisk, "survival_prob": survivalProb};
  })

  for (let [index, row] of survivalProbsTable.entries()) {
      let survivalProb = row.survival_prob;
      let lastCumSurvivalProb = index != 0 ? survivalProbsTable[index-1].cumSurvivalProb : 1;
      survivalProbsTable[index].cum_survival_prob = lastCumSurvivalProb * survivalProb;
  }
  return {"all":survivalProbsTable};
}

/**
 * This function renders the survival plots
 * @param {JSON} inputData JSON whose keys represent the different feature values to plot survival curves for
 */
const create_survival_plot = function(inputData) {
  let survivalLoaderDiv = "#survivalLoaderDiv";
  let survivalPlotDiv = "#survivalPlot";
  // Set up the figure dimensions:
  let margin = {top: 10, right: 30, bottom: 10, left: 40},
  width = 505 - margin.left - margin.right,
  height = 200 - margin.top - margin.bottom;
  //Declare feature fields
  let timeFeature = "time";
  let survivalFeature = "survival_prob"
  let numSurvivorsFeature = "patients_at_risk";
  //Extract survival data of interest to plot
  survivalData = inputData["all"]
  let maxTime = -1;
  let plotData = [];
  for(let index = 0; index < survivalData.length; index++) {
    if(survivalData[index]["survivalProb"] != -Infinity) {
      plotData.push({"time":survivalData[index][timeFeature], 
        "survival_prob":survivalData[index][survivalFeature]});
      if(survivalData[index][timeFeature] > maxTime)
        maxTime = survivalData[index][timeFeature]
    }
  }
  //Create SVG object to append plot to
  let svgObject = d3.select(survivalLoaderDiv).append("svg")
    .attr("id", survivalPlotDiv)
    .attr("viewBox", `0 -35 505 300`)  // This line makes the svg responsive
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
  //Build and append x-axis
  let xScale = d3.scaleLinear()
    .domain([0, maxTime])
    .range([0, width]);
  svgObject.append("g")
    .attr("transform", "translate(0," + height + ")")
    .call(d3.axisBottom(xScale))
    .style("font-size", "8px");
  //Append x-axis label
  svgObject.append("text")
    .attr("transform", "translate(" + width/2 + ", " + (height + margin.top + 25) + ")")
    .text("Time (Days)")
    .style("font-size", "12px");
 //Build and append y-axis
  let yScale = d3.scaleLinear()
    .domain([0, 1])
    .range([height, 0])
  svgObject.append("g").call(d3.axisLeft(yScale))
    .style("font-size", "8px");
  //Append y-axis label
  svgObject.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left)
    .attr("x",-(height / 2.0))
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .style("font-size", "12px")
    .text("Survival Rate");
  //Build survival curve
  let line = d3.line()
    .x((data) => xScale(data.time))
    .y((data) => yScale(data.survival_prob))
    .curve(d3.curveStep);
  //Generate survival curve
  svgObject
    .append("path")
    .attr("d", line(plotData))
    .attr("fill", "none") 
    .attr("stroke", "blue");
}