"use client"

import Snowfall from 'react-snowfall';

const SnowfallComponent = () => {
  return (
    <div className="absolute top-0 left-0 w-full h-full">
      <Snowfall
        color="white" // Color of the snowflakes
        snowflakeCount={500} // Number of snowflakes
        style={{ zIndex: 1 }} // Ensure it appears above other elements
      />
    </div>
  );
};

export default SnowfallComponent;
