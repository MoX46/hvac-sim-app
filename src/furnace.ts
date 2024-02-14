import { HVACAppliance, HVACApplianceResponse } from "./types";

const BTU_PER_CCF_NATURAL_GAS = 103700;

export class GasFurnace implements HVACAppliance {
  private deratedCapacityBtusPerHour: number;

  constructor(
    private options: {
      // afue is short for Annual Fuel Utilization Efficiency,
      // typically around 96-98% for modern furnaces, and 80%
      // for older ones.
      afuePercent: number;

      capacityBtusPerHour: number;

      elevationFeet: number;
    }
  ) {
    // The National Fuel Gas Code requires that gas appliances installed
    // above 2,000 feet elevation have their inputs de-rated by 4% per 1,000
    // feet above sea level.
    //
    // https://www.questargas.com/ForEmployees/qgcOperationsTraining/Furnaces/York_YP9C.pdf
    let capacityElevationMultiplier = 1;
    if (this.options.elevationFeet > 2000) {
      capacityElevationMultiplier =
        1.0 - Math.floor(this.options.elevationFeet / 1000) * 0.04;
    }
    this.deratedCapacityBtusPerHour =
      this.options.capacityBtusPerHour * capacityElevationMultiplier;
  }

  getThermalResponse(options: {
    btusPerHourNeeded: number;
    insideAirTempF: number;
    outsideAirTempF: number;
  }): HVACApplianceResponse {
    if (options.btusPerHourNeeded < 0) {
      // Furnaces can't cool :)
      return { btusPerHour: 0, fuelUsage: {} };
    }
    // Gas furnaces' efficiency in converting natural gas to heat is independent
    // of the temperature differential.

    const btusPerHourProduced = Math.min(
      options.btusPerHourNeeded,
      this.deratedCapacityBtusPerHour
    );

    const btuConsumptionRate =
      btusPerHourProduced / (this.options.afuePercent / 100.0);
    const ccfConsumptionRate = btuConsumptionRate / BTU_PER_CCF_NATURAL_GAS;

    return {
      btusPerHour: btusPerHourProduced,
      fuelUsage: {
        naturalGasCcfPerHour: ccfConsumptionRate,
      },
    };
  }
}
