// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\middleware\pagination.js
exports.paginateResults = (model, populateOptions = []) => {
    return async (req, res, next) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const sort = req.query.sort || '-createdAt';
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
  
      const results = {};
  
      try {
        // Build query
        let query = model.find();
        
        // Apply populate
        populateOptions.forEach(option => {
          query = query.populate(option);
        });
  
        // Apply sorting
        query = query.sort(sort);
  
        // Get total count
        const total = await model.countDocuments();
        results.total = total;
        results.totalPages = Math.ceil(total / limit);
        results.currentPage = page;
        results.limit = limit;
  
        // Apply pagination
        if (endIndex < total) {
          results.next = {
            page: page + 1,
            limit
          };
        }
  
        if (startIndex > 0) {
          results.previous = {
            page: page - 1,
            limit
          };
        }
  
        results.data = await query.limit(limit).skip(startIndex);
  
        res.paginatedResults = results;
        next();
      } catch (error) {
        console.error('Pagination error:', error);
        res.status(500).json({ message: 'Pagination failed', error: error.message });
      }
    };
  };