//contentScript.js
const html = `<div id="partial-users-participants" class="discussion-sidebar-item">
  <div class="participation">
    <div class="discussion-sidebar-heading text-bold">
      Estimate
    </div>
    <div class="participation-avatars d-flex flex-wrap">
      <div class="estimated-container">
        <select class="form-select select-sm d-block estimated" style="width:200px;" title="Estimated Time">
          <option value="">(none)</option>
            <optgroup label="Minutes">
            <option value="15 Minutes">15 Minutes</option>
            <option value="30 Minutes">30 Minutes</option>
          </optgroup>
          <optgroup label="Hours">
            <option value="1 Hour">1 Hour </option>
            <option value="2 Hours">2 Hours</option>
            <option value="3 Hours">3 Hours</option>
            <option value="4 Hours">4 Hours</option>
            <option value="5 Hours">5 Hours</option>
            <option value="6 Hours">6 Hours</option>
            <option value="7 Hours">7 Hours</option>
            <option value="8 Hours">8 Hours</option>
          </optgroup>
          <optgroup label="Days">
            <option value="1 Day">1 Day </option>
            <option value="2 Days">2 Days</option>
            <option value="3 Days">3 Days</option>
            <option value="4 Days">4 Days</option>
            <option value="5 Days">5 Days</option>
          </optgroup>
          <optgroup label="Weeks">
            <option value="1 Week">1 Week </option>
            <option value="2 Weeks">2 Weeks</option>
            <option value="3 Weeks">3 Weeks</option>
            <option value="4 Weeks">4 Weeks</option>
          </optgroup>
          <optgroup label="Months">
            <option value="1 Month">1 Month </option>
            <option value="2 Months">2 Months</option>
          </optgroup>
        </select>
      </div>
    </div>
  </div>
</div>`;

const defaultMetaData = {
  estimated: "",
  time: null,
  startAt: null
};
const estimationCSS = `
  margin: 5px 0;
  color: #ffffff;
  padding: 5px 12px;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  border: 1px solid transparent;
  border-radius: 2em;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const issuesEnhancer = {
  token: null,
  username: null,
  repository: null,
  timers: new Map(),
  cards: new Map(),

  clearIssueTimes(issueId, body, metadata) {
    if (metadata.startAt !== null || metadata.time !== null) {
      metadata.startAt = null;
      metadata.time = null;
      this.setIssueMetadata(issueId, body, metadata);
      console.log("updating......");
    }

    console.log("Done");
  },

  createTimer(cardId, startTime) {
    const $card = this.getCardById(cardId);

    this.clearTimer(cardId);

    let minutes = startTime;
    let second = 0;

    const countUp = () => {
      second++;

      if (second === 59) {
        second = 0;
        minutes = minutes + 1;
      }

      const totalSeconds = minutes * 60 + second;
      const formatTime = new Date(totalSeconds * 1000)
        .toISOString()
        .substr(11, 8);

      $card.find(".estimation__timer").html(formatTime);
    };

    const timerId = setInterval(countUp, 1000);

    this.timers.set(cardId, timerId);
  },

  clearTimer(cardId) {
    const timerId = this.timers.get(cardId);

    clearInterval(timerId);

    this.timers.delete(cardId);
  },

  calculateTime(oldTime, time) {
    // get total seconds between the times
    let delta = Math.abs(oldTime - time) / 1000;

    // calculate (and subtract) whole days
    const days = Math.floor(delta / 86400);
    delta -= days * 86400;

    // calculate (and subtract) whole hours
    const hours = Math.floor(delta / 3600) % 24;
    delta -= hours * 3600;

    // calculate (and subtract) whole minutes
    const minutes = Math.floor(delta / 60) % 60;
    delta -= minutes * 60;

    // what's left is seconds
    const seconds = delta % 60;

    return { days, hours, minutes, seconds };
  },

  getIssueId($issueRow) {
    const $node = $(
      ".gh-header-title .f1-light, .js-project-issue-details-container .js-issue-number",
      $issueRow
    );

    if ($node.length) {
      const id = $node.html().replace("#", "");

      if (id) {
        return id;
      }
    }

    return null;
  },

  async getIssueMetadata($issueRow) {
    const issueId = this.getIssueId($issueRow);
    if (issueId == null) return;

    await this.getIssue(issueId).then(data => {
      if (data) {
        const metadata = this.parseBody(data.body);

        // Fill data
        $issueRow.data("issueId", issueId);
        $issueRow.data("body", data.body);
        $issueRow.data("metadata", metadata);

        // Fill controls
        $issueRow.find(".estimated").val(metadata.estimated);
      }
    });
  },

  parseBody(body) {
    const $wrapper = $("<div></div>").append(body);

    let metadata = null;

    $wrapper
      .contents()
      .filter(function() {
        return (
          this.nodeType === 8 &&
          this.nodeValue.startsWith("GitHubIssuesEnhancements=")
        );
      })
      .each(function(i, e) {
        const json = e.nodeValue
          .replace("GitHubIssuesEnhancements=", "")
          .trim();

        try {
          const obj = JSON.parse(json);
          metadata = { ...defaultMetaData, ...obj };
        } catch (e) {
          console.log(e);
        }
      });

    if (metadata == null) {
      metadata = defaultMetaData;
      const enhancements = JSON.stringify(defaultMetaData);
      $wrapper.append(`\n\n\n<!--GitHubIssuesEnhancements=${enhancements}-->`);
    }

    return metadata;
  },

  setIssueMetadata(issueId, body, metadata) {
    const $wrapper = $("<div></div>").append(body);
    let found = false;

    $wrapper
      .contents()
      .filter(function() {
        return (
          this.nodeType === 8 &&
          this.nodeValue.startsWith("GitHubIssuesEnhancements=")
        );
      })
      .each(function(i, e) {
        found = true;
        e.nodeValue = "GitHubIssuesEnhancements=" + JSON.stringify(metadata);
      });

    if (!found) {
      const enhancements = JSON.stringify(defaultMetaData);
      $wrapper.append(`\n\n\n<!--GitHubIssuesEnhancements=${enhancements}-->`);
    }

    this.updateIssue(issueId, $wrapper.html());
  },

  async getIssue(id) {
    let result = null;
    const self = this;
    try {
      result = await $.ajax({
        url: `https://api.github.com/repos/${self.username}/${self.repository}/issues/${id}`,
        dataType: "json",
        type: "GET",
        beforeSend: function(xhr) {
          xhr.setRequestHeader("Authorization", "token " + self.token);
        }
      });
    } catch (e) {
      console.log(e);
    }

    return result;
  },

  updateIssue(id, body) {
    const self = this;
    $.ajax({
      url: `https://api.github.com/repos/${self.username}/${self.repository}/issues/${id}`,
      type: "POST",
      beforeSend: function(xhr) {
        xhr.setRequestHeader("Authorization", "token " + self.token);
      },
      data: JSON.stringify({ body })
    });
  },

  getCardById(cardId) {
    const $card = $(`#card-${cardId}`);

    if ($card.children().length) {
      return $card;
    }

    return this.getCardById(cardId);
  },

  init() {
    const self = this;

    $(".repository-content").each(function() {
      const $this = $(this);
      const $controls = $(html);

      $this.find("#partial-discussion-sidebar").prepend($controls);
      self.getIssueMetadata($this);
    });

    $(".estimated").change(function(e) {
      const $this = $(this);
      const $issueRow = $this.closest(".repository-content");
      const metadata = $issueRow.data("metadata");
      const issueId = $issueRow.data("issueId");
      const body = $issueRow.data("body");
      metadata.estimated = $this.val();

      self.setIssueMetadata(issueId, body, metadata);
    });

    // in Projects
    const $project = $(".project-columns-container");

    if ($project.length) {
      $(".js-project-columns-container .project-column").each(function() {
        const $node = $(this);
        const title = $node.find(".js-project-column-name").html();
        const isDoing = title.includes("Doing..");

        if (isDoing) {
          const node = $node.get(0);
          self.updateProjectColumn($node);

          const handleUpdate = column => {
            if (!column.closest(".estimationEmpty, .d-none")) {
              self.updateProjectColumn($(column));
            }
          };

          self.mutationObserver(node, handleUpdate);
        }
      });
    }
  },

  generateCardHTML($card, metadata) {
    const cardId = $card.data().cardId;
    const $estimatedEmpty = $card.find(".estimationEmpty");
    let htmlContent = `Estimate: ${metadata.estimated}`;
    let estimationEmpty = "#0e8a16";

    if (metadata.estimated === "") {
      htmlContent = "Estimate is needed!";
      estimationEmpty = "#d73a4a";
    }

    const $timerHTML = `<div class="estimation__timer">${metadata.time}</div>`;

    if ($estimatedEmpty.length) {
      $estimatedEmpty.html(`${htmlContent} ${$timerHTML}`);
    } else {
      const html = `
        <div class="estimationEmpty" style="background-color: ${estimationEmpty}; ${estimationCSS}">
          ${htmlContent}
          ${$timerHTML}
        </div>`;

      // paste html after 1 frame
      requestAnimationFrame(() => {
        $card.find(".js-project-card-issue-link").after(html);
      });
    }

    // set timer
    this.createTimer(cardId, metadata.time);
  },

  updateProjectColumn($column) {
    const self = this;

    const currentCards = new Map();

    const $columns = $column.find("article.issue-card");

    $columns.each(function() {
      const $card = $(this);
      const cardId = $card.data().cardId;

      currentCards.set(cardId, $card);

      if (!self.cards.has(cardId)) {
        self.cards.set(cardId, { metadata: null });

        const issueId = self.getIssueId($card);

        self.getIssue(issueId).then(data => {
          const metadata = self.parseBody(data.body);

          self.cards.set(cardId, { metadata });

          if (metadata.time === null) {
            metadata.time = 0;
            self.setIssueMetadata(issueId, data.body, metadata);
          }

          if (metadata.startAt === null) {
            metadata.startAt = `${new Date()}`;
            self.setIssueMetadata(issueId, data.body, metadata);
          }

          self.generateCardHTML($card, metadata);
        });
      } else {
        const { metadata } = self.cards.get(cardId);
        const $card = self.getCardById(cardId);

        if (metadata && $card.length) {
          self.generateCardHTML($card, metadata);
        }
      }
    });

    const noCards = $column.children().length === 0;

    if ($columns.length || noCards) {
      [...this.cards].forEach(([cardId]) => {
        if (!currentCards.has(cardId)) {
          const $card = self.getCardById(cardId);
          const issueId = self.getIssueId($card);

          self.getIssue(issueId).then(data => {
            const metadata = self.parseBody(data.body);

            if (metadata.startAt) {
              const startAt = new Date(metadata.startAt);
              const endTime = new Date();
              const time = metadata.time ?? 0;
              const diffTime = self.calculateTime(startAt, endTime).minutes;

              metadata.time = time + diffTime;
              metadata.startAt = null;
              self.setIssueMetadata(issueId, data.body, metadata);
            }
          });

          self.cards.delete(cardId);
          self.clearTimer(cardId);
        }
      });
    }
  },

  mutationObserver(node, cb) {
    const callback = mutationsList => {
      for (const mutation of mutationsList) {
        const target = mutation.target;

        cb(target);
      }
    };

    const observer = new MutationObserver(callback);

    const config = {
      childList: true,
      subtree: true
    };

    observer.observe(node, config);
  },

  beforeInit() {
    const self = this;
    const arr = window.location.pathname.split("/");

    if (arr.length < 3) return;
    this.username = arr[1];
    this.repository = arr[2];

    // Read it using the storage API
    chrome.storage.sync.get(["personalAccessToken"], function(items) {
      self.token = items.personalAccessToken;
      self.init();
    });
  }
};

issuesEnhancer.beforeInit();
