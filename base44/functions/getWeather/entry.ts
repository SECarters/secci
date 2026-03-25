import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify user is authenticated
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ 
                error: 'Unauthorized' 
            }, { status: 401 });
        }

        const apiKey = Deno.env.get('OPENWEATHER_API_KEY');
        
        if (!apiKey) {
            return Response.json({ 
                error: 'Weather API key not configured',
                data: null
            }, { status: 200 });
        }

        // Brisbane coordinates
        const lat = -27.4698;
        const lon = 153.0251;

        // Fetch current weather and forecast
        const [currentResponse, forecastResponse] = await Promise.all([
            fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`),
            fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`)
        ]);

        if (!currentResponse.ok || !forecastResponse.ok) {
            throw new Error('Failed to fetch weather data');
        }

        const currentData = await currentResponse.json();
        const forecastData = await forecastResponse.json();

        // Calculate rain chance from forecast (next 12 hours)
        const next12Hours = forecastData.list.slice(0, 4); // 4 x 3-hour periods
        const rainForecasts = next12Hours.filter(item => 
            item.weather[0].main.toLowerCase().includes('rain')
        );
        const rainChance = Math.round((rainForecasts.length / next12Hours.length) * 100);

        // Calculate total rain expected in next 12 hours (in mm)
        const totalRain = next12Hours.reduce((sum, item) => {
            return sum + (item.rain?.['3h'] || 0);
        }, 0);

        const weatherData = {
            temp: currentData.main.temp,
            feels_like: currentData.main.feels_like,
            description: currentData.weather[0].description,
            humidity: currentData.main.humidity,
            pressure: currentData.main.pressure,
            wind_speed: currentData.wind.speed,
            wind_deg: currentData.wind.deg,
            rain_chance: rainChance,
            rain_amount: Math.round(totalRain * 10) / 10, // Round to 1 decimal
            icon: currentData.weather[0].icon
        };

        return Response.json({ 
            success: true,
            data: weatherData
        });

    } catch (error) {
        console.error('Error fetching weather:', error);
        return Response.json({ 
            error: error.message || 'Failed to fetch weather data',
            data: null
        }, { status: 200 }); // Return 200 so app doesn't break if weather fails
    }
});